// src/app/api/mercadopago/checkout/route.ts
import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

// ⚠️ ATENÇÃO: use exatamente esses nomes de variáveis no .env
// MERCADOPAGO_ACCESS_TOKEN=APP_USR-...
// MP_INTEGRATOR_ID=dev_24c65fb163bf11ea96500242ac130004
// NEXT_PUBLIC_SITE_URL=https://thouse-rec.com.br   (ou a URL do Vercel enquanto isso)

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
const INTEGRATOR_ID = process.env.MP_INTEGRATOR_ID;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Planos básicos para o servidor saber valores (não importa serem repetidos do front)
const PLANOS = [
  {
    id: "bronze",
    nome: "Plano Bronze",
    mensal: 149.99,
    anual: 1499.99,
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 349.99,
    anual: 3799.99,
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 549.99,
    anual: 5499.99,
  },
] as const;

type ModoPlano = "mensal" | "anual";

export async function POST(req: Request) {
  try {
    if (!ACCESS_TOKEN) {
      console.error("MERCADOPAGO_ACCESS_TOKEN não configurado.");
      return NextResponse.json(
        { error: "Configuração de pagamento ausente no servidor." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { planoId, modo, userName, userEmail } = body as {
      planoId?: string;
      modo?: ModoPlano;
      userName?: string;
      userEmail?: string;
    };

    // validações simples
    if (!planoId || !modo || !userName || !userEmail) {
      return NextResponse.json(
        { error: "Dados incompletos para criar o pagamento." },
        { status: 400 }
      );
    }

    const plano = PLANOS.find((p) => p.id === planoId);
    if (!plano) {
      return NextResponse.json(
        { error: "Plano inválido." },
        { status: 400 }
      );
    }

    const valor =
      modo === "mensal" ? plano.mensal : plano.anual;

    // ---------- SDK NOVA (v2) ----------
    const client = new MercadoPagoConfig({
      accessToken: ACCESS_TOKEN,
      options: {
        integratorId: INTEGRATOR_ID, // pode ser undefined sem problema
      },
    });

    const preference = new Preference(client);

    const prefResult = await preference.create({
      body: {
        payer: {
          name: userName,
          email: userEmail,
        },
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
        auto_return: "approved",
        notification_url: `${SITE_URL}/api/mercadopago/webhook`,
      },
    });

    // Na SDK nova, o link de checkout normalmente vem em init_point
    const initPoint =
      (prefResult as any).init_point ||
      (prefResult as any).sandbox_init_point;

    if (!initPoint) {
      console.error("Resposta do Mercado Pago sem init_point:", prefResult);
      return NextResponse.json(
        { error: "Não foi possível obter o link de pagamento." },
        { status: 500 }
      );
    }

    return NextResponse.json({ initPoint });
  } catch (err) {
    console.error("Erro ao criar pagamento no Mercado Pago:", err);
    return NextResponse.json(
      { error: "Erro ao criar pagamento." },
      { status: 500 }
    );
  }
}
