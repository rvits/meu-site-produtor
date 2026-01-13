import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validação básica
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    console.log("WEBHOOK RECEBIDO:", body.type || body.action);

    // Quando pagamento é aprovado
    if (body.type === "payment" || body.action === "payment.updated") {
      const paymentId = body.data?.id || body.data_id;
      
      if (paymentId) {
        // TODO: Buscar pagamento no Mercado Pago e salvar no Prisma
        // Por enquanto apenas loga
        console.log("Pagamento processado:", paymentId);
        
        // Exemplo futuro:
        // const payment = await mercadoPagoClient.payment.get(paymentId);
        // await prisma.payment.create({ ... });
        // if (payment.status === "approved") {
        //   await prisma.userPlan.create({ ... });
        // }
      }
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error("Erro no webhook:", err);
    // Sempre retornar 200 para o Mercado Pago não reenviar
    return NextResponse.json({ received: true, error: "Internal error" });
  }
}
