// src/app/api/asaas/checkout/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { checkoutSchema } from "@/app/lib/validations";
import { AsaasProvider } from "@/app/lib/payment-providers";
import { prisma } from "@/app/lib/prisma";

import { getAsaasApiKey } from "@/app/lib/env";

const ASAAS_API_KEY = getAsaasApiKey();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const IS_TEST = process.env.NODE_ENV !== "production";

// Planos básicos (mesmos do Mercado Pago para compatibilidade)
const PLANOS = [
  {
    id: "bronze",
    nome: "Plano Bronze",
    mensal: 197.00,
    anual: 1970.00,
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 347.00,
    anual: 3470.00,
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 547.00,
    anual: 5470.00,
  },
] as const;

type ModoPlano = "mensal" | "anual";

export async function POST(req: Request) {
  try {
    // 🔒 Verificar autenticação
    const user = await requireAuth();

    // Debug: Verificar se a variável está sendo lida
    console.log("[Asaas Checkout] Verificando ASAAS_API_KEY...");
    console.log("[Asaas Checkout] ASAAS_API_KEY existe:", !!ASAAS_API_KEY);
    console.log("[Asaas Checkout] ASAAS_API_KEY length:", ASAAS_API_KEY?.length || 0);

    if (!ASAAS_API_KEY) {
      console.error("[Asaas Checkout] ASAAS_API_KEY não configurado.");
      console.error("[Asaas Checkout] Variáveis de ambiente disponíveis:", Object.keys(process.env).filter(k => k.includes('ASAAS')));
      return NextResponse.json(
        { error: "Configuração de pagamento ausente no servidor. Reinicie o servidor após configurar ASAAS_API_KEY no .env" },
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
    
    // Buscar CPF do usuário
    const userWithCpf = await prisma.user.findUnique({
      where: { id: user.id },
      select: { cpf: true },
    });

    const plano = PLANOS.find((p) => p.id === planoId);
    if (!plano) {
      return NextResponse.json(
        { error: "Plano inválido." },
        { status: 400 }
      );
    }

    const valor = modo === "mensal" ? plano.mensal : plano.anual;

    // 📋 NÃO criar plano antes do pagamento
    // Os dados serão armazenados no metadata e o plano será criado apenas após pagamento confirmado no webhook
    console.log("[Asaas] Dados do plano preparados para criação após pagamento");

    // Criar provedor Asaas
    const provider = new AsaasProvider(ASAAS_API_KEY, IS_TEST);

    // Preparar itens
    const items = [
      {
        id: plano.id,
        title: `${plano.nome} - ${modo === "mensal" ? "Mensal" : "Anual"}`,
        quantity: 1,
        unit_price: Number(valor.toFixed(2)),
        currency_id: "BRL",
      },
    ];

    console.log("[Asaas] Criando checkout para plano:", {
      planoId,
      modo,
      valor,
      userEmail,
    });

    // IMPORTANTE: Asaas limita externalReference a 100 caracteres
    // 1. Salvar metadata completo em PaymentMetadata ANTES de criar checkout
    // 2. Passar apenas userId no externalReference (máximo 36 caracteres)
    // 3. No webhook, buscar metadata usando userId do externalReference
    
    console.log("[Asaas] Salvando metadata completo em PaymentMetadata...");
    
    const metadataCompleto = {
      tipo: "plano",
      userId: user.id,
      planId: planoId,
      planName: plano.nome,
      modo,
      amount: valor.toString(),
      paymentMethod: paymentMethod || "pix",
      billingDay: new Date().getDate(),
    };
    
    // Criar registro de PaymentMetadata com todos os dados
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // Expira em 24 horas
    
    const paymentMetadata = await prisma.paymentMetadata.create({
      data: {
        userId: user.id,
        metadata: JSON.stringify(metadataCompleto),
        expiresAt,
      },
    });
    
    console.log("[Asaas] PaymentMetadata criado:", paymentMetadata.id);
    console.log("[Asaas] Usando apenas userId no externalReference:", user.id);

    // Criar checkout
    const checkoutResponse = await provider.createCheckout({
      items,
      payer: {
        name: userName,
        email: userEmail,
        cpf: userWithCpf?.cpf || undefined,
      },
      paymentMethod: paymentMethod || undefined, // Passar método de pagamento escolhido
      metadata: {
        userId: user.id, // APENAS userId - metadata completo está em PaymentMetadata
      },
      backUrls: {
        success: `${SITE_URL}/pagamentos/sucesso?tipo=plano`,
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
    console.error("[Asaas] Erro ao criar checkout:", err);
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
