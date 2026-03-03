import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { refundAsaasPayment } from "@/app/lib/asaas-refund";

/**
 * Solicita reembolso do plano cancelado.
 * Valor reembolsado = valor do plano proporcional aos cupons que ainda estavam ativos (não utilizados).
 * Cupons já utilizados não são reembolsáveis.
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
        { error: "O reembolso deste plano já foi solicitado." },
        { status: 400 }
      );
    }

    const totalCupons = userPlan.coupons.length;
    const cuponsUsados = userPlan.coupons.filter((c) => c.used);
    const cuponsNaoUsados = totalCupons - cuponsUsados.length;

    // Valor reembolsável = proporção do valor do plano referente aos cupons que não foram usados
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

    // Encontrar o pagamento do plano no Asaas (inclui plano teste: busca por tipo "plano" e data próxima)
    const userPlanCreated = new Date(userPlan.createdAt).getTime();
    const janelaMs = 48 * 60 * 60 * 1000; // 48h

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
      pagamentosPlano.find((p) => Math.abs(new Date(p.createdAt).getTime() - userPlanCreated) <= janelaMs) ??
      pagamentosPlano[0] ?? null;

    if (!payment?.asaasId) {
      return NextResponse.json(
        {
          error:
            "Pagamento do plano não encontrado ou sem vínculo com o Asaas. Entre em contato com o suporte para solicitar o reembolso.",
        },
        { status: 400 }
      );
    }

    let reembolsoJaEmAndamento = false;
    try {
      await refundAsaasPayment(
        payment.asaasId,
        valorReembolsavelArredondado,
        `Reembolso do plano ${userPlan.planName} (cupons não utilizados)`
      );
    } catch (err: any) {
      const msg = String(err?.message || "").toLowerCase();
      const body = typeof err?.body === "string" ? err.body : JSON.stringify(err?.body || {});
      if (
        msg.includes("400") ||
        msg.includes("já está em andamento") ||
        msg.includes("already in progress") ||
        body.includes("estorno") && body.includes("em andamento")
      ) {
        reembolsoJaEmAndamento = true;
        console.log("[Solicitar Reembolso Plano] Asaas informou que o estorno já está em andamento; tratando como sucesso.");
      } else {
        console.error("[Solicitar Reembolso Plano] Erro Asaas:", err);
        return NextResponse.json(
          {
            error:
              err.message || "Erro ao processar reembolso no Asaas. Tente novamente ou entre em contato.",
          },
          { status: 502 }
        );
      }
    }

    try {
      await prisma.userPlan.update({
        where: { id: userPlanId },
        data: { refundProcessedAt: new Date() },
      });
    } catch (updateErr: any) {
      const msg = String(updateErr?.message || "").toLowerCase();
      if (msg.includes("unknown column") || msg.includes("does not exist") || msg.includes("refundProcessedAt")) {
        console.warn("[Solicitar Reembolso Plano] Coluna refundProcessedAt pode não existir no banco. Rode: npx prisma db push");
      } else {
        console.error("[Solicitar Reembolso Plano] Erro ao atualizar refundProcessedAt:", updateErr);
      }
      // Reembolso no Asaas já foi feito; não falhar a resposta por falha no update
    }

    return NextResponse.json({
      message: reembolsoJaEmAndamento
        ? "O reembolso desta cobrança já estava em andamento no Asaas. O valor será creditado em até 5 dias úteis."
        : "Reembolso solicitado com sucesso. O valor será creditado em até 5 dias úteis.",
      refundAmount: valorReembolsavelArredondado,
      cuponsNaoUsados,
      totalCupons,
    });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    console.error("[Solicitar Reembolso Plano] Erro:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao solicitar reembolso." },
      { status: 500 }
    );
  }
}
