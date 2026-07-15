// src/app/api/mercadopago/checkout-agendamento/route.ts
import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { requireAuth } from "@/app/lib/auth";
import { z } from "zod";
import { calculateServerCheckout } from "@/app/lib/checkout-calculation";

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const INTEGRATOR_ID = process.env.MP_INTEGRATOR_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const agendamentoCheckoutSchema = z.object({
  servicos: z.array(z.object({
    id: z.string(),
    nome: z.string().optional(),
    quantidade: z.number().int().min(1).max(20),
    preco: z.number().optional(),
  })).optional(),
  beats: z.array(z.object({
    id: z.string(),
    nome: z.string().optional(),
    quantidade: z.number().int().min(1).max(20),
    preco: z.number().optional(),
  })).optional(),
  data: z.string(),
  hora: z.string(),
  duracaoMinutos: z.number().optional(),
  tipo: z.string().optional(),
  observacoes: z.string().optional(),
  paymentMethod: z.enum(["cartao_credito", "cartao_debito", "pix", "boleto"]).optional(),
  cupomCode: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    // 🔒 Verificar autenticação
    const user = await requireAuth();

    if (!ACCESS_TOKEN) {
      console.error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
      return NextResponse.json(
        { error: "Configuração de pagamento ausente no servidor." },
        { status: 500 }
      );
    }

    // Validar formato do token
    if (!ACCESS_TOKEN.startsWith("APP_USR-") && !ACCESS_TOKEN.startsWith("TEST-")) {
      console.error("[MP-AGENDAMENTO] Token com formato inválido:", ACCESS_TOKEN.substring(0, 20));
      return NextResponse.json(
        { error: "Token do Mercado Pago com formato inválido. Verifique se está correto no .env" },
        { status: 500 }
      );
    }

    const body = await req.json();
    
    // ✅ Validar entrada
    const validation = agendamentoCheckoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    let { servicos = [], beats = [], data, hora, paymentMethod, cupomCode } = validation.data;
    let calculation;
    try {
      calculation = await calculateServerCheckout({
        userId: user.id,
        services: servicos,
        beats,
        couponCode: cupomCode,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return NextResponse.json(
        {
          error: message.startsWith("CUPOM_INVALIDO:")
            ? message.slice("CUPOM_INVALIDO:".length)
            : "Serviço ou quantidade inválida.",
        },
        { status: 400 }
      );
    }
    servicos = calculation.services;
    beats = calculation.beats;
    const total = calculation.total;
    if (total <= 0) {
      return NextResponse.json(
        { error: "Use o fluxo de resgate para concluir um agendamento sem cobrança." },
        { status: 400 }
      );
    }

    // Criar itens para o Mercado Pago
    const items: any[] = [];

    // Com cupom: usar um único item com total descontado. Sem cupom: itens individuais
    const usarItemUnico = cupomCode && cupomCode.trim();

    if (!usarItemUnico) {
    servicos.forEach((s) => {
      items.push({
        id: s.id,
        title: `${s.nome} (x${s.quantidade})`,
        quantity: s.quantidade,
        unit_price: Number(s.preco!.toFixed(2)),
        currency_id: "BRL",
      });
    });

    beats.forEach((b) => {
      items.push({
        id: b.id,
        title: `${b.nome} (x${b.quantidade})`,
        quantity: b.quantidade,
        unit_price: Number(b.preco!.toFixed(2)),
        currency_id: "BRL",
      });
    });
    }

    // Se não houver itens (ou cupom aplicado), criar um item genérico
    if (items.length === 0 || usarItemUnico) {
      items.length = 0; // Limpar para cupom
      items.push({
        id: "agendamento",
        title: `Agendamento - ${new Date(data).toLocaleDateString("pt-BR")} às ${hora}`,
        quantity: 1,
        unit_price: Number(total.toFixed(2)),
        currency_id: "BRL",
      });
    }

    // ---------- SDK NOVA (v2) ----------
    // Criar cliente sem Integrator ID primeiro (pode estar causando o erro UNAUTHORIZED)
    const client = new MercadoPagoConfig({
      accessToken: ACCESS_TOKEN,
      // Removendo integratorId temporariamente para resolver erro UNAUTHORIZED
      // Se necessário, pode ser adicionado depois quando o token estiver configurado corretamente
    });

    const preference = new Preference(client);

    // Preparar o body da preferência - versão simplificada para evitar erro UNAUTHORIZED
    const preferenceBody: any = {
      items,
      back_urls: {
        success: `${SITE_URL}/pagamentos/sucesso`,
        failure: `${SITE_URL}/pagamentos/falha`,
        pending: `${SITE_URL}/pagamentos/pendente`,
      },
    };

    // Adicionar payer apenas se necessário (pode causar erro em alguns casos)
    if (user.nomeArtistico && user.email) {
      preferenceBody.payer = {
        name: user.nomeArtistico,
        email: user.email,
      };
    }

    // Adicionar metadata apenas se necessário
    if (user.id || data || hora) {
      preferenceBody.metadata = {
        tipo: "agendamento",
        userId: user.id,
        data: data || null,
        hora: hora || null,
        paymentMethod: paymentMethod || null,
        cupomCode: cupomCode?.trim() || undefined,
        servicos: JSON.stringify(servicos),
        beats: JSON.stringify(beats),
        total: total.toString(),
      };
    }

    // notification_url e auto_return removidos para evitar erro UNAUTHORIZED
    // Esses campos podem causar problemas com tokens que não têm permissões completas

    console.log("[MP-AGENDAMENTO] Criando preferência com body:", JSON.stringify(preferenceBody, null, 2));
    console.log("[MP-AGENDAMENTO] Token type:", ACCESS_TOKEN?.startsWith("TEST-") ? "TEST" : "PRODUCTION");
    console.log("[MP-AGENDAMENTO] Integrator ID:", INTEGRATOR_ID || "não configurado (removido para evitar erro UNAUTHORIZED)");

    const prefResult = await preference.create({
      body: preferenceBody,
    });

    console.log("[MP] Resposta completa do Mercado Pago (agendamento):", JSON.stringify(prefResult, null, 2));

    // Na SDK nova (v2), a resposta pode vir em diferentes formatos
    let initPoint: string | undefined;
    
    // Tentar diferentes propriedades possíveis
    if (typeof prefResult === 'object' && prefResult !== null) {
      const result = prefResult as any;
      
      // SDK v2 pode retornar diretamente ou dentro de propriedades
      initPoint = result.init_point || 
                  result.sandbox_init_point || 
                  result.initPoint ||
                  result.sandboxInitPoint ||
                  result.url ||
                  result.checkout_url ||
                  result.init_point_url ||
                  result.sandbox_init_point_url ||
                  // Tentar acessar propriedades aninhadas
                  (result.response && result.response.init_point) ||
                  (result.data && result.data.init_point) ||
                  (result.body && result.body.init_point);
    }

    // Se ainda não encontrou, tentar serializar e buscar
    if (!initPoint) {
      const resultStr = JSON.stringify(prefResult);
      const match = resultStr.match(/"init_point":\s*"([^"]+)"/);
      if (match) {
        initPoint = match[1];
      }
    }

    if (!initPoint) {
      console.error("[MP] Resposta do Mercado Pago sem init_point. Estrutura completa:", prefResult);
      console.error("[MP] Tipo da resposta:", typeof prefResult);
      console.error("[MP] Chaves disponíveis:", Object.keys(prefResult || {}));
      return NextResponse.json(
        { 
          error: "Não foi possível obter o link de pagamento.",
          debug: process.env.NODE_ENV === "development" ? {
            responseType: typeof prefResult,
            responseKeys: Object.keys(prefResult || {}),
            response: prefResult
          } : undefined
        },
        { status: 500 }
      );
    }

    console.log("[MP] Link de checkout obtido (agendamento):", initPoint);
    return NextResponse.json({ initPoint });
  } catch (err: any) {
    console.error("[MP-AGENDAMENTO] Erro completo ao criar pagamento:", err);
    console.error("[MP-AGENDAMENTO] Tipo do erro:", err?.constructor?.name);
    console.error("[MP-AGENDAMENTO] Mensagem do erro:", err?.message);
    console.error("[MP-AGENDAMENTO] Stack do erro:", err?.stack);
    
    if (err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    
    // Erro específico de UNAUTHORIZED do Mercado Pago
    if (err.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES" || err.message?.includes("UNAUTHORIZED")) {
      const errorDetails = `
ERRO DE AUTORIZAÇÃO DO MERCADO PAGO

Este erro geralmente ocorre quando:
1. O Access Token não tem permissões para criar preferências
2. O token está expirado ou inválido
3. A aplicação não está ativa no painel do Mercado Pago

SOLUÇÕES:
1. Acesse: https://www.mercadopago.com.br/developers/panel
2. Vá em "Suas integrações" > Selecione sua aplicação
3. Verifique se a aplicação está ATIVA
4. Gere um NOVO Access Token (Test ou Production)
5. Copie o novo token e atualize no arquivo .env
6. Reinicie o servidor Next.js

IMPORTANTE:
- Tokens de TESTE começam com "TEST-"
- Tokens de PRODUÇÃO começam com "APP_USR-"
- Certifique-se de usar o token correto para o ambiente

      `.trim();
      
      return NextResponse.json(
        { 
          error: errorDetails,
          debug: process.env.NODE_ENV === "development" ? {
            message: err?.message,
            code: err?.code,
            status: err?.status,
            blockedBy: err?.blocked_by,
            suggestion: "Gere um novo Access Token no painel do Mercado Pago e atualize o .env"
          } : undefined
        },
        { status: 403 }
      );
    }
    
    const errorMessage = err?.message || "Erro desconhecido ao criar pagamento";
    return NextResponse.json(
      { 
        error: process.env.NODE_ENV === "development" 
          ? `Erro ao criar pagamento: ${errorMessage}` 
          : "Erro ao criar pagamento. Tente novamente mais tarde.",
        debug: process.env.NODE_ENV === "development" ? {
          message: err?.message,
          type: err?.constructor?.name,
          stack: err?.stack
        } : undefined
      },
      { status: 500 }
    );
  }
}
