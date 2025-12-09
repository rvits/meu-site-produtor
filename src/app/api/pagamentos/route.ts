// src/app/api/pagamentos/route.ts
import { NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";

export const runtime = "nodejs";

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
  {
    id: "teste",
    nome: "Plano Teste",
    mensal: 1.0,
    anual: 1.0,
  },
];

const ACCESS_TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN;
// const INTEGRATOR_ID = process.env.MP_INTEGRATOR_ID;

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

let preferenceClient: Preference | null = null;

function getPreferenceClient() {
  if (!ACCESS_TOKEN) {
    console.error(
      "[MP] MERCADOPAGO_ACCESS_TOKEN não configurado no .env (backend)"
    );
    throw new Error("MERCADOPAGO_ACCESS_TOKEN não configurado no .env");
  }

  if (!preferenceClient) {
    console.log(
      "[MP] Criando cliente Preference. SITE_URL:",
      SITE_URL,
      "token prefix:",
      ACCESS_TOKEN.slice(0, 10) + "..."
    );

    const client = new MercadoPagoConfig({
      accessToken: ACCESS_TOKEN,
      // options: INTEGRATOR_ID ? { integratorId: INTEGRATOR_ID } : undefined,
    });

    preferenceClient = new Preference(client);
  }

  return preferenceClient;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { planoId, modo, userId, nome, email } = body;

    if (!planoId || !modo || !userId || !nome || !email) {
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

    const valor = modo === "mensal" ? plano.mensal : plano.anual;

    const preference = getPreferenceClient();

    console.log("[MP] Criando preferência...", {
      planoId,
      modo,
      valor,
      email,
      nome,
    });

    const prefResult = await preference.create({
      body: {
        payer: {
          name: nome,
          email,
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
          failure: `${SITE_URL}/pagamentos/falha`,
          pending: `${SITE_URL}/pagamentos/pendente`,
        },
        auto_return: "approved",
        metadata: {
          planoId,
          modo,
          userId,
        },
      },
    });

    const initPoint =
      (prefResult as any).init_point ??
      (prefResult as any).sandbox_init_point;

    if (!initPoint) {
      console.error("Resultado da preferência sem init_point:", prefResult);
      return NextResponse.json(
        { error: "Não foi possível obter o link de pagamento." },
        { status: 500 }
      );
    }

    return NextResponse.json({ init_point: initPoint });
  } catch (err: any) {
    // 👇 AQUI a gente loga MUITO mais coisa no console do servidor
    console.error("[MP] Erro ao criar pagamento (detalhado):");
    console.error("tipo:", typeof err);
    console.error("mensagem:", err?.message);
    console.error("status:", err?.status ?? err?.cause?.status);
    console.error("erro bruto:", err);

    const msg =
      err?.message ?? (typeof err === "string" ? err : JSON.stringify(err));

    return NextResponse.json(
      {
        error: "Erro ao criar pagamento no servidor.",
        details: msg,
      },
      { status: 500 }
    );
  }
}
