// src/app/api/asaas/checkout-carrinho/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { z } from "zod";
import { AsaasProvider } from "@/app/lib/payment-providers";
import { prisma } from "@/app/lib/prisma";
import { getAsaasApiKey } from "@/app/lib/env";

const ASAAS_API_KEY = getAsaasApiKey();
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const IS_TEST = process.env.NODE_ENV !== "production";

const itemSchema = z.object({
  data: z.string(),
  hora: z.string(),
  duracaoMinutos: z.number().optional(),
  tipo: z.string().optional(),
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
  total: z.number(),
  observacoes: z.string().optional(),
});

const carrinhoCheckoutSchema = z.object({
  items: z.array(itemSchema).min(1, "Carrinho deve ter pelo menos um agendamento"),
  total: z.number().positive("Total deve ser maior que zero"),
  paymentMethod: z.enum(["cartao_credito", "cartao_debito", "pix", "boleto"]).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireAuth();

    if (!ASAAS_API_KEY) {
      return NextResponse.json(
        { error: "Configuração de pagamento ausente no servidor. Configure ASAAS_API_KEY no .env" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const validation = carrinhoCheckoutSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0]?.message || "Dados inválidos" },
        { status: 400 }
      );
    }

    const { items, total, paymentMethod } = validation.data;
    const userEmail = user.email || "";
    const userName = (user.nomeArtistico || user.nomeCompleto || "Cliente") as string;

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

    // Verificar conflitos de horário para cada item
    for (const item of items) {
      const dataHoraISO = new Date(`${item.data}T${item.hora}:00`);
      const duracao = item.duracaoMinutos ?? 60;
      const conflito = await prisma.appointment.findFirst({
        where: {
          status: { not: "cancelado" },
          AND: [
            { data: { lt: new Date(dataHoraISO.getTime() + duracao * 60000) } },
            { data: { gte: new Date(dataHoraISO.getTime() - duracao * 60000) } },
          ],
        },
      });
      if (conflito) {
        return NextResponse.json(
          { error: `Já existe um agendamento em ${item.data} às ${item.hora}. Remova ou altere no carrinho.` },
          { status: 409 }
        );
      }
    }

    // Salvar metadata em PaymentMetadata para o webhook encontrar após o pagamento
    try {
      const metadataCompleto = {
        tipo: "carrinho",
        userId: user.id,
        items: JSON.stringify(items),
        total: total.toString(),
        paymentMethod: paymentMethod || null,
      };
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);
      await prisma.paymentMetadata.create({
        data: {
          userId: user.id,
          metadata: JSON.stringify(metadataCompleto),
          expiresAt,
        },
      });
    } catch (metaErr) {
      console.warn("[Asaas Checkout Carrinho] PaymentMetadata não criado (continuando):", metaErr);
    }

    const provider = new AsaasProvider(ASAAS_API_KEY, IS_TEST);
    const descricao = `Carrinho THouse Rec - ${items.length} agendamento(s)`;

    const checkoutResponse = await provider.createCheckout({
      items: [
        {
          id: "carrinho",
          title: descricao,
          quantity: 1,
          unit_price: Number(total.toFixed(2)),
          currency_id: "BRL",
        },
      ],
      payer: {
        name: userName,
        email: userEmail,
        cpf: cpfLimpo,
      },
      paymentMethod: paymentMethod || undefined,
      metadata: {
        tipo: "carrinho",
        userId: user.id,
        items: JSON.stringify(items),
        total: total.toString(),
        paymentMethod: paymentMethod || null,
      },
      backUrls: {
        success: `${SITE_URL}/pagamentos/sucesso?tipo=agendamento`,
        failure: `${SITE_URL}/pagamentos/falha`,
        pending: `${SITE_URL}/pagamentos/pendente`,
      },
    });

    return NextResponse.json({
      initPoint: checkoutResponse.initPoint,
      provider: "asaas",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const safeMessage = message || "Erro desconhecido ao criar pagamento";
    if (safeMessage === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[Asaas Checkout Carrinho] Erro completo:", err);
    return NextResponse.json({ error: safeMessage }, { status: 500 });
  }
}
