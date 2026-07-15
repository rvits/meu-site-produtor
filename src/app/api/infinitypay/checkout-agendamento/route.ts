// src/app/api/infinitypay/checkout-agendamento/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { z } from "zod";
import { InfinityPayProvider } from "@/app/lib/payment-providers";
import { calculateServerCheckout } from "@/app/lib/checkout-calculation";

const INFINITYPAY_API_KEY = process.env.INFINITYPAY_API_KEY;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const IS_TEST = process.env.NODE_ENV !== "production";

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

    if (!INFINITYPAY_API_KEY) {
      console.error("INFINITYPAY_API_KEY não configurado.");
      return NextResponse.json(
        { error: "Configuração de pagamento ausente no servidor." },
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

    // Criar itens para o Infinity Pay
    const items: any[] = [];
    const usarItemUnico = cupomCode && cupomCode.trim();

    if (!usarItemUnico) {
    servicos.forEach((s) => {
      const unitPrice = Number(s.preco!.toFixed(2));
      if (unitPrice <= 0 || isNaN(unitPrice)) {
        throw new Error(`Preço inválido para serviço ${s.nome}: ${s.preco}`);
      }
      items.push({
        id: String(s.id || `servico_${Date.now()}`).substring(0, 50),
        title: String(`${s.nome} (x${s.quantidade})`).substring(0, 127),
        quantity: Number(s.quantidade) || 1,
        unit_price: unitPrice,
        currency_id: "BRL",
      });
    });

    beats.forEach((b) => {
      const unitPrice = Number(b.preco!.toFixed(2));
      if (unitPrice <= 0 || isNaN(unitPrice)) {
        throw new Error(`Preço inválido para beat ${b.nome}: ${b.preco}`);
      }
      items.push({
        id: String(b.id || `beat_${Date.now()}`).substring(0, 50),
        title: String(`${b.nome} (x${b.quantidade})`).substring(0, 127),
        quantity: Number(b.quantidade) || 1,
        unit_price: unitPrice,
        currency_id: "BRL",
      });
    });
    }

    // Se não houver itens (ou cupom aplicado), criar um item genérico
    if (items.length === 0 || usarItemUnico) {
      items.length = 0;
      const unitPrice = Number(total.toFixed(2));
      if (unitPrice < 0 || isNaN(unitPrice)) {
        throw new Error(`Total inválido: ${total}`);
      }
      items.push({
        id: "agendamento",
        title: `Agendamento - ${new Date(data).toLocaleDateString("pt-BR")} às ${hora}`.substring(0, 127),
        quantity: 1,
        unit_price: unitPrice,
        currency_id: "BRL",
      });
    }

    // Criar provedor Infinity Pay
    const provider = new InfinityPayProvider(INFINITYPAY_API_KEY, IS_TEST);

    console.log("[InfinityPay] Criando checkout para agendamento:", {
      data,
      hora,
      total,
      itemsCount: items.length,
    });

    // Criar checkout
    const checkoutResponse = await provider.createCheckout({
      items,
      payer: {
        name: user.nomeArtistico,
        email: user.email,
      },
      metadata: {
        tipo: "agendamento",
        userId: user.id,
        data: data || null,
        hora: hora || null,
        paymentMethod: paymentMethod || null,
        cupomCode: cupomCode?.trim() || undefined,
        servicos: JSON.stringify(servicos),
        beats: JSON.stringify(beats),
        total: total.toString(),
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
    console.error("[InfinityPay] Erro ao criar checkout de agendamento:", err);
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
