// src/app/api/mercadopago/checkout/route.ts
import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { requireAuth } from "@/app/lib/auth";
import { checkoutSchema } from "@/app/lib/validations";

// ⚠️ ATENÇÃO: use exatamente esses nomes de variáveis no .env
// MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
// MP_INTEGRATOR_ID=dev_24c65fb163bf11ea96500242ac130004
// NEXT_PUBLIC_SITE_URL=https://thouse-rec.com.br   (ou a URL do Vercel enquanto isso)

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const INTEGRATOR_ID = process.env.MP_INTEGRATOR_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

import { PLAN_PRICES } from "@/app/lib/plan-prices";

type ModoPlano = "mensal" | "anual";

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

    const body = await req.json();
    
    // ✅ Validar entrada
    const validation = checkoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { planId: planoId, modo, paymentMethod } = validation.data;
    const userName = user.nomeArtistico;
    const userEmail = user.email;

    const plano = PLAN_PRICES.find((p) => p.id === planoId);
    if (!plano) {
      return NextResponse.json(
        { error: "Plano inválido." },
        { status: 400 }
      );
    }

    const valor =
      modo === "mensal" ? plano.mensal : plano.anual;

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
      items: [
        {
          id: plano.id,
          title: `${plano.nome} - ${
            modo === "mensal" ? "Mensal" : "Anual"
          }`,
          quantity: 1,
          unit_price: Number(valor.toFixed(2)),
          currency_id: "BRL",
        },
      ],
      back_urls: {
        success: `${SITE_URL}/pagamentos/sucesso`,
        failure: `${SITE_URL}/pagamentos/erro`,
        pending: `${SITE_URL}/pagamentos/pendente`,
      },
    };

    // Adicionar payer apenas se necessário
    if (userName && userEmail) {
      preferenceBody.payer = {
        name: userName,
        email: userEmail,
      };
    }

    // Adicionar metadata apenas se necessário
    if (user.id || planoId || modo) {
      preferenceBody.metadata = {
        tipo: "plano",
        userId: user.id,
        planId: planoId || null,
        modo: modo || null,
        paymentMethod: paymentMethod || null,
      };
    }

    // notification_url e auto_return removidos para evitar erro UNAUTHORIZED
    // Esses campos podem causar problemas com tokens que não têm permissões completas

    console.log("[MP-PLANO] Criando preferência com body:", JSON.stringify(preferenceBody, null, 2));
    console.log("[MP-PLANO] Token type:", ACCESS_TOKEN?.startsWith("TEST-") ? "TEST" : "PRODUCTION");
    console.log("[MP-PLANO] Token prefix:", ACCESS_TOKEN?.substring(0, 20) + "...");
    console.log("[MP-PLANO] Integrator ID:", INTEGRATOR_ID || "não configurado (removido para evitar erro UNAUTHORIZED)");

    const prefResult = await preference.create({
      body: preferenceBody,
    });

    console.log("[MP] Resposta completa do Mercado Pago:", JSON.stringify(prefResult, null, 2));

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

    console.log("[MP] Link de checkout obtido:", initPoint);
    return NextResponse.json({ initPoint });
  } catch (err: any) {
    console.error("[MP-PLANO] Erro completo ao criar pagamento:", err);
    console.error("[MP-PLANO] Tipo do erro:", err?.constructor?.name);
    console.error("[MP-PLANO] Mensagem do erro:", err?.message);
    console.error("[MP-PLANO] Stack do erro:", err?.stack);
    
    if (err?.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    
    // Erro específico de UNAUTHORIZED do Mercado Pago
    if (err.code === "PA_UNAUTHORIZED_RESULT_FROM_POLICIES" || err.message?.includes("UNAUTHORIZED")) {
      return NextResponse.json(
        { 
          error: "Erro de autorização do Mercado Pago. Verifique: 1) Se o Access Token está correto e ativo, 2) Se o token tem permissão para criar preferências, 3) Se a aplicação está ativa no painel do Mercado Pago. Acesse: https://www.mercadopago.com.br/developers/panel",
          debug: process.env.NODE_ENV === "development" ? {
            message: err?.message,
            code: err?.code,
            status: err?.status,
            tokenPrefix: ACCESS_TOKEN?.substring(0, 20) + "..."
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
