// src/app/api/asaas/checkout-agendamento/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { z } from "zod";
import { AsaasProvider } from "@/app/lib/payment-providers";
import { prisma } from "@/app/lib/prisma";
import { validateCouponAndGetTotal } from "@/app/lib/validate-coupon-checkout";

import { getAsaasApiKey } from "@/app/lib/env";

const ASAAS_API_KEY = getAsaasApiKey();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const IS_TEST = process.env.NODE_ENV !== "production";

const agendamentoCheckoutSchema = z.object({
  servicos: z.array(z.object({
    id: z.string(),
    nome: z.string(),
    quantidade: z.number(),
    preco: z.number(),
  })).optional(),
  beats: z.array(z.object({
    id: z.string(),
    nome: z.string(),
    quantidade: z.number(),
    preco: z.number(),
  })).optional(),
  data: z.string(),
  hora: z.string(),
  duracaoMinutos: z.number().optional(),
  tipo: z.string().optional(),
  observacoes: z.string().optional(),
  total: z.number(),
  paymentMethod: z.enum(["cartao_credito", "cartao_debito", "pix", "boleto"]).optional(),
  cupomCode: z.string().optional(), // Código do cupom aplicado
});

export async function POST(req: Request) {
  try {
    // 🔒 Verificar autenticação
    const user = await requireAuth();

    // Debug: Verificar se a variável está sendo lida
    console.log("[Asaas Checkout Agendamento] Verificando ASAAS_API_KEY...");
    console.log("[Asaas Checkout Agendamento] ASAAS_API_KEY existe:", !!ASAAS_API_KEY);

    if (!ASAAS_API_KEY) {
      console.error("[Asaas Checkout Agendamento] ASAAS_API_KEY não configurado.");
      return NextResponse.json(
        { error: "Configuração de pagamento ausente no servidor. Reinicie o servidor após configurar ASAAS_API_KEY no .env" },
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

    let { servicos, beats, data, hora, duracaoMinutos, tipo, observacoes, total, paymentMethod, cupomCode } = validation.data;
    const userName = user.nomeArtistico;

    // Validar cupom e recalcular total quando aplicável
    if (cupomCode && cupomCode.trim()) {
      const totalRaw =
        (servicos || []).reduce((a: number, s: any) => a + (s.preco || 0) * (s.quantidade || 1), 0) +
        (beats || []).reduce((a: number, b: any) => a + (b.preco || 0) * (b.quantidade || 1), 0);
      const result = await validateCouponAndGetTotal(
        cupomCode.trim(),
        totalRaw,
        servicos || [],
        beats || []
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      total = result.finalTotal;
    }
    const userEmail = user.email;
    
    // Buscar CPF do usuário (obrigatório para Asaas)
    const userWithCpf = await prisma.user.findUnique({
      where: { id: user.id },
      select: { cpf: true },
    });

    const cpfLimpo = userWithCpf?.cpf?.replace(/\D/g, "");
    if (!cpfLimpo || cpfLimpo.length !== 11) {
      return NextResponse.json(
        { error: "CPF é obrigatório para pagamentos. Preencha seu CPF na página de pagamentos antes de continuar." },
        { status: 400 }
      );
    }

    // 🗓️ NÃO criar agendamento antes do pagamento
    // Os dados serão armazenados no metadata e o agendamento será criado apenas após pagamento confirmado no webhook
    const dataHoraISO = new Date(`${data}T${hora}:00`);
    const duracao = duracaoMinutos || 60;

    // Verificar conflitos (mas não criar ainda). select só id para funcionar mesmo sem colunas cancelReason/etc no banco
    const conflito = await prisma.appointment.findFirst({
      where: {
        status: { not: "cancelado" },
        AND: [
          { data: { lt: new Date(dataHoraISO.getTime() + (duracao * 60000)) } },
          { data: { gte: new Date(dataHoraISO.getTime() - (duracao * 60000)) } },
        ],
      },
      select: { id: true },
    });

    if (conflito) {
      return NextResponse.json(
        { error: "Já existe um agendamento neste horário." },
        { status: 409 }
      );
    }

    console.log("[Asaas] Dados do agendamento preparados para criação após pagamento");

    // Criar provedor Asaas
    const provider = new AsaasProvider(ASAAS_API_KEY, IS_TEST);

    // Preparar descrição do agendamento
    const descricaoItens: string[] = [];
    if (servicos && servicos.length > 0) {
      servicos.forEach(s => {
        descricaoItens.push(`${s.nome} (${s.quantidade}x)`);
      });
    }
    if (beats && beats.length > 0) {
      beats.forEach(b => {
        descricaoItens.push(`${b.nome} (${b.quantidade}x)`);
      });
    }
    
    const descricao = `Agendamento THouse Rec - ${data} ${hora}${descricaoItens.length > 0 ? ` - ${descricaoItens.join(", ")}` : ""}`;

    // Preparar itens para o checkout
    const items = [
      {
        id: "agendamento",
        title: descricao,
        quantity: 1,
        unit_price: Number(total.toFixed(2)),
        currency_id: "BRL",
      },
    ];

    console.log("[Asaas] Criando checkout para agendamento:", {
      data,
      hora,
      total,
      userEmail,
    });

    // Salvar metadata em PaymentMetadata para o webhook encontrar após o pagamento (linkagem Asaas)
    const metadataCompleto = {
      tipo: "agendamento",
      userId: user.id,
      data,
      hora,
      duracaoMinutos: duracaoMinutos || 60,
      tipoAgendamento: tipo || "sessao",
      observacoes: observacoes || "",
      servicos: servicos || [],
      beats: beats || [],
      total: total.toString(),
      paymentMethod: paymentMethod || null,
      cupomCode: cupomCode || undefined,
    };
    const expiresAtAg = new Date();
    expiresAtAg.setHours(expiresAtAg.getHours() + 24);
    try {
      await prisma.paymentMetadata.create({
        data: {
          userId: user.id,
          metadata: JSON.stringify(metadataCompleto),
          expiresAt: expiresAtAg,
        },
      });
    } catch (metaErr: any) {
      console.warn("[Asaas Checkout Agendamento] PaymentMetadata não criado (continuando):", metaErr?.message);
    }

    // Criar checkout (externalReference = apenas userId; metadata completo está em PaymentMetadata)
    const checkoutResponse = await provider.createCheckout({
      items,
      payer: {
        name: userName,
        email: userEmail,
        cpf: cpfLimpo,
      },
      paymentMethod: paymentMethod || undefined, // Passar método de pagamento escolhido
      metadata: {
        userId: user.id, // APENAS userId - metadata completo está em PaymentMetadata
      },
      backUrls: {
        success: `${SITE_URL}/pagamentos/sucesso?tipo=agendamento`,
        failure: `${SITE_URL}/pagamentos/falha`,
        pending: `${SITE_URL}/pagamentos/pendente`,
      },
    });

    console.log("[Asaas] Checkout criado com sucesso:", checkoutResponse.initPoint);
    
    return NextResponse.json({ 
      initPoint: checkoutResponse.initPoint,
      provider: "asaas",
    });
  } catch (err: any) {
    console.error("[Asaas] Erro ao criar checkout de agendamento:", err);
    console.error("[Asaas] Tipo do erro:", err?.constructor?.name);
    console.error("[Asaas] Mensagem do erro:", err?.message);
    
    if (err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    
    const errorMessage = err?.message || "Erro desconhecido ao criar pagamento";
    return NextResponse.json(
      { 
        error: errorMessage,
        debug: process.env.NODE_ENV === "development" ? {
          message: err?.message,
          stack: err?.stack,
        } : undefined
      },
      { status: 500 }
    );
  }
}
