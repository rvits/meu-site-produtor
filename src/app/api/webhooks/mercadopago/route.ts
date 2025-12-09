import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("WEBHOOK RECEBIDO:", body);

    // Quando pagamento é aprovado
    if (body.type === "payment") {
      // Aqui você busca o pagamento no Mercado Pago...
      // ...e salva no Prisma como assinatura ativa.
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("Erro no webhook:", err);
    return NextResponse.json({ error: true }, { status: 500 });
  }
}
