// src/app/api/infinitypay/checkout/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { checkoutSchema } from "@/app/lib/validations";
import { InfinityPayProvider } from "@/app/lib/payment-providers";

const INFINITYPAY_API_KEY = process.env.INFINITYPAY_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const IS_TEST = process.env.NODE_ENV !== "production";

// Planos básicos (mesmos do Mercado Pago para compatibilidade)
const PLANOS = [
  {
    id: "bronze",
    nome: "Plano Bronze",
    mensal: 29.90,
    anual: 299.00,
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 49.90,
    anual: 499.00,
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 79.90,
    anual: 799.00,
  },
] as const;

type ModoPlano = "mensal" | "anual";

export async function POST(req: Request) {
  try {
    // 🔒 Verificar autenticação
    const user = await requireAuth();

    if (!INFINITYPAY_API_KEY) {
      console.error("INFINITYPAY_API_KEY não configurado.");
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

    const plano = PLANOS.find((p) => p.id === planoId);
    if (!plano) {
      return NextResponse.json(
        { error: "Plano inválido." },
        { status: 400 }
      );
    }

    const valor = modo === "mensal" ? plano.mensal : plano.anual;

    // Criar provedor Infinity Pay
    const provider = new InfinityPayProvider(INFINITYPAY_API_KEY, IS_TEST);

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

    console.log("[InfinityPay] Criando checkout para plano:", {
      planoId,
      modo,
      valor,
      userEmail,
    });

    // Criar checkout
    const checkoutResponse = await provider.createCheckout({
      items,
      payer: {
        name: userName,
        email: userEmail,
      },
      metadata: {
        tipo: "plano",
        userId: user.id,
        planId: planoId,
        modo,
        paymentMethod: paymentMethod || null,
      },
      backUrls: {
        success: `${SITE_URL}/pagamentos/sucesso`,
        failure: `${SITE_URL}/pagamentos/falha`,
        pending: `${SITE_URL}/pagamentos/pendente`,
      },
    });

    console.log("[InfinityPay] Checkout criado com sucesso:", checkoutResponse.initPoint);
    
    return NextResponse.json({ 
      initPoint: checkoutResponse.initPoint,
      provider: "infinitypay",
    });
  } catch (err: any) {
    console.error("[InfinityPay] Erro ao criar checkout:", err);
    console.error("[InfinityPay] Tipo do erro:", err?.constructor?.name);
    console.error("[InfinityPay] Mensagem do erro:", err?.message);
    
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
