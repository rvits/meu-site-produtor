import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getAsaasApiKey } from "@/app/lib/env";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId");

    if (!paymentId) {
      return NextResponse.json(
        { error: "ID do pagamento é obrigatório" },
        { status: 400 }
      );
    }

    // Buscar pagamento no banco de dados
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { asaasId: paymentId },
          { mercadopagoId: paymentId },
        ],
      },
    });

    if (payment) {
      // Verificar se há plano associado
      const userPlan = await prisma.userPlan.findFirst({
        where: {
          userId: payment.userId,
          planId: payment.planId || undefined,
          status: { in: ["active", "pending"] },
        },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        status: payment.status,
        paymentId: payment.id,
        amount: payment.amount,
        processed: true,
        userPlan: userPlan ? {
          id: userPlan.id,
          planId: userPlan.planId,
          planName: userPlan.planName,
          status: userPlan.status,
        } : null,
      });
    }

    // Se não encontrou no banco, tentar buscar diretamente no Asaas
    const apiKey = getAsaasApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key não configurada" },
        { status: 500 }
      );
    }

    const isProduction = apiKey.startsWith("$aact_prod_");
    const apiUrl = isProduction
      ? "https://www.asaas.com/api/v3"
      : "https://sandbox.asaas.com/api/v3";

    try {
      const response = await fetch(`${apiUrl}/payments/${paymentId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "access_token": apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          status: data.status,
          paymentId: data.id,
          amount: data.value,
        });
      } else {
        return NextResponse.json(
          { error: "Pagamento não encontrado" },
          { status: 404 }
        );
      }
    } catch (error: any) {
      console.error("[Verificar Pagamento] Erro ao buscar no Asaas:", error);
      return NextResponse.json(
        { error: "Erro ao verificar pagamento" },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("[Verificar Pagamento] Erro:", err);
    return NextResponse.json(
      { error: "Erro interno ao verificar pagamento" },
      { status: 500 }
    );
  }
}
