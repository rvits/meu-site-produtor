import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { getAsaasApiKey } from "@/app/lib/env";

/**
 * Verifica status de pagamento por paymentId (Asaas) ou operationId (PaymentMetadata).
 * GO-04A.2 RC-09: suporte a operationId para a página de sucesso fazer poll sem DomainSync.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId");
    const operationId = searchParams.get("operationId");

    if (!paymentId && !operationId) {
      return NextResponse.json(
        { error: "ID do pagamento ou operationId é obrigatório" },
        { status: 400 }
      );
    }

    if (operationId) {
      const meta = await prisma.paymentMetadata.findUnique({
        where: { id: operationId },
        select: { id: true, asaasId: true, userId: true, metadata: true },
      });

      if (!meta) {
        return NextResponse.json({
          status: "pending",
          processed: false,
          effectsReady: false,
          operationId,
          message: "Operação ainda não encontrada",
        });
      }

      let tipo = "agendamento";
      try {
        const parsed = JSON.parse(meta.metadata || "{}") as { tipo?: string };
        if (parsed.tipo === "plano" || parsed.tipo === "carrinho" || parsed.tipo === "agendamento") {
          tipo = parsed.tipo;
        }
      } catch {
        // metadata inválido — manter default
      }

      const payment = meta.asaasId
        ? await prisma.payment.findFirst({
            where: {
              OR: [{ asaasId: meta.asaasId }, { mercadopagoId: meta.asaasId }],
            },
            orderBy: { createdAt: "desc" },
          })
        : null;

      if (!payment || payment.status !== "approved") {
        return NextResponse.json({
          status: payment?.status || "pending",
          processed: false,
          effectsReady: false,
          operationId,
          paymentId: payment?.id ?? null,
          providerPaymentId: meta.asaasId,
          tipo,
        });
      }

      let effectsReady = false;
      if (tipo === "plano") {
        const userPlan = await prisma.userPlan.findFirst({
          where: {
            userId: payment.userId,
            status: { in: ["active", "pending"] },
            ...(payment.planId ? { planId: payment.planId } : {}),
          },
          orderBy: { createdAt: "desc" },
        });
        effectsReady = Boolean(userPlan);
      } else {
        effectsReady = Boolean(
          payment.appointmentId ||
            (payment.appointmentIds != null &&
              (Array.isArray(payment.appointmentIds)
                ? payment.appointmentIds.length > 0
                : String(payment.appointmentIds).length > 2))
        );
      }

      return NextResponse.json({
        status: payment.status,
        processed: true,
        effectsReady,
        operationId,
        paymentId: payment.id,
        providerPaymentId: meta.asaasId,
        amount: payment.amount,
        tipo,
      });
    }

    // Buscar pagamento no banco de dados
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { asaasId: paymentId! },
          { mercadopagoId: paymentId! },
        ],
      },
    });

    if (payment) {
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
        effectsReady: Boolean(
          userPlan || payment.appointmentId || payment.appointmentIds
        ),
        userPlan: userPlan
          ? {
              id: userPlan.id,
              planId: userPlan.planId,
              planName: userPlan.planName,
              status: userPlan.status,
            }
          : null,
      });
    }

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
          access_token: apiKey,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return NextResponse.json({
          status: data.status,
          paymentId: data.id,
          amount: data.value,
          processed: false,
          effectsReady: false,
        });
      }
      return NextResponse.json(
        { error: "Pagamento não encontrado" },
        { status: 404 }
      );
    } catch (error: unknown) {
      console.error("[Verificar Pagamento] Erro ao buscar no Asaas:", error);
      return NextResponse.json(
        { error: "Erro ao verificar pagamento" },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    console.error("[Verificar Pagamento] Erro:", err);
    return NextResponse.json(
      { error: "Erro interno ao verificar pagamento" },
      { status: 500 }
    );
  }
}
