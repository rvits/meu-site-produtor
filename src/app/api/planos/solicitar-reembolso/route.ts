import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { refundAsaasPayment } from "@/app/lib/asaas-refund";
import { logFinancialFailure, logFinancialInfo } from "@/app/lib/financial-ops-log";

/**
 * Solicita reembolso do plano cancelado.
 * Valor reembolsado = valor do plano proporcional aos cupons que ainda estavam ativos (não utilizados).
 * Cupons já utilizados não são reembolsáveis.
 *
 * GO-04A.2: persiste refundAsaasStatus pending/failed/confirmed path;
 * reserva atômica (idempotência) antes de chamar o gateway.
 */
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { userPlanId } = body;

    if (!userPlanId) {
      return NextResponse.json({ error: "ID do plano é obrigatório" }, { status: 400 });
    }

    const userPlan = await prisma.userPlan.findUnique({
      where: { id: userPlanId },
      include: { coupons: true },
    });

    if (!userPlan) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }
    if (userPlan.userId !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    if (userPlan.status !== "cancelled") {
      return NextResponse.json(
        { error: "Reembolso só está disponível para planos cancelados." },
        { status: 400 }
      );
    }
    if (userPlan.refundProcessedAt) {
      return NextResponse.json(
        {
          error: "O reembolso deste plano já foi solicitado.",
          refundAsaasStatus: userPlan.refundAsaasStatus ?? "pending",
        },
        { status: 400 }
      );
    }

    const totalCupons = userPlan.coupons.length;
    const cuponsUsados = userPlan.coupons.filter((c) => c.used);
    const cuponsNaoUsados = totalCupons - cuponsUsados.length;

    const valorReembolsavel =
      totalCupons > 0
        ? (userPlan.amount / totalCupons) * cuponsNaoUsados
        : userPlan.amount;

    const valorReembolsavelArredondado = Math.round(valorReembolsavel * 100) / 100;
    if (valorReembolsavelArredondado <= 0) {
      return NextResponse.json(
        {
          error:
            "Não há valor a reembolsar. Todos os cupons deste plano já foram utilizados.",
        },
        { status: 400 }
      );
    }

    const userPlanCreated = new Date(userPlan.createdAt).getTime();
    const janelaMs = 48 * 60 * 60 * 1000;

    const pagamentosPlano = await prisma.payment.findMany({
      where: {
        userId: user.id,
        type: "plano",
        status: "approved",
        asaasId: { not: null },
      },
      orderBy: { createdAt: "desc" },
    });

    const payment =
      pagamentosPlano.find(
        (p) => Math.abs(new Date(p.createdAt).getTime() - userPlanCreated) <= janelaMs
      ) ??
      pagamentosPlano[0] ??
      null;

    if (!payment?.asaasId) {
      logFinancialFailure({
        paymentId: payment?.id ?? null,
        provider: "asaas",
        motivo: "Pagamento do plano sem asaasId para reembolso",
        status: "failed",
        code: "PLAN_REFUND_PAYMENT_MISSING",
        extra: { userPlanId },
      });
      return NextResponse.json(
        {
          error:
            "Pagamento do plano não encontrado ou sem vínculo com o Asaas. Entre em contato com o suporte para solicitar o reembolso.",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    // RC-12: reserva atômica — só um request consegue o slot
    const reserved = await prisma.userPlan.updateMany({
      where: {
        id: userPlanId,
        userId: user.id,
        status: "cancelled",
        refundProcessedAt: null,
      },
      data: {
        refundRequestedAt: now,
        refundProcessedAt: now,
        refundAmount: valorReembolsavelArredondado,
        refundAsaasStatus: "pending",
      },
    });

    if (reserved.count === 0) {
      const again = await prisma.userPlan.findUnique({
        where: { id: userPlanId },
        select: { refundProcessedAt: true, refundAsaasStatus: true },
      });
      return NextResponse.json(
        {
          error: "O reembolso deste plano já foi solicitado.",
          refundAsaasStatus: again?.refundAsaasStatus ?? "pending",
          alreadyProcessed: true,
        },
        { status: 409 }
      );
    }

    let reembolsoJaEmAndamento = false;
    try {
      await refundAsaasPayment(
        payment.asaasId,
        valorReembolsavelArredondado,
        `Reembolso do plano ${userPlan.planName} (cupons não utilizados)`
      );
      logFinancialInfo({
        paymentId: payment.id,
        provider: "asaas",
        providerPaymentId: payment.asaasId,
        motivo: "Reembolso de plano solicitado no gateway",
        status: "pending",
        code: "PLAN_REFUND_REQUESTED",
        extra: { userPlanId, refundAmount: valorReembolsavelArredondado },
      });
    } catch (err: unknown) {
      const errAny = err as { message?: string; body?: unknown };
      const msg = String(errAny?.message || "").toLowerCase();
      const body =
        typeof errAny?.body === "string"
          ? errAny.body
          : JSON.stringify(errAny?.body || {});
      if (
        msg.includes("400") ||
        msg.includes("já está em andamento") ||
        msg.includes("already in progress") ||
        (body.includes("estorno") && body.includes("em andamento"))
      ) {
        reembolsoJaEmAndamento = true;
        logFinancialInfo({
          paymentId: payment.id,
          provider: "asaas",
          providerPaymentId: payment.asaasId,
          motivo: "Estorno já em andamento no Asaas — tratado como sucesso idempotente",
          status: "pending",
          code: "PLAN_REFUND_ALREADY_IN_PROGRESS",
          extra: { userPlanId },
        });
      } else {
        await prisma.userPlan.updateMany({
          where: { id: userPlanId, refundAsaasStatus: "pending" },
          data: {
            refundAsaasStatus: "failed",
            // Libera nova tentativa; mantém refundRequestedAt/refundAmount para auditoria
            refundProcessedAt: null,
          },
        });
        logFinancialFailure({
          paymentId: payment.id,
          provider: "asaas",
          providerPaymentId: payment.asaasId,
          motivo: errAny?.message || "Erro ao processar reembolso no Asaas",
          status: "failed",
          code: "PLAN_REFUND_ASAAS_ERROR",
          extra: { userPlanId },
        });
        return NextResponse.json(
          {
            error:
              errAny?.message ||
              "Erro ao processar reembolso no Asaas. Tente novamente ou entre em contato.",
          },
          { status: 502 }
        );
      }
    }

    return NextResponse.json({
      message: reembolsoJaEmAndamento
        ? "O reembolso desta cobrança já estava em andamento no Asaas. O valor será creditado em até 5 dias úteis."
        : "Reembolso solicitado com sucesso. O valor será creditado em até 5 dias úteis.",
      refundAmount: valorReembolsavelArredondado,
      refundAsaasStatus: "pending",
      cuponsNaoUsados,
      totalCupons,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Acesso negado" || message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    logFinancialFailure({
      provider: "asaas",
      motivo: message || "Erro ao solicitar reembolso de plano",
      status: "failed",
      code: "PLAN_REFUND_UNHANDLED",
    });
    return NextResponse.json(
      { error: message || "Erro ao solicitar reembolso." },
      { status: 500 }
    );
  }
}
