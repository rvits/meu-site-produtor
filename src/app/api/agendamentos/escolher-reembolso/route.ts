import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { refundAsaasPayment } from "@/app/lib/asaas-refund";
import { fetchAsaasPayment, asaasPaymentIsRefundedStatus } from "@/app/lib/asaas-get-payment";
import { listAsaasPaymentsReceived } from "@/app/lib/asaas-list-payments";
import { generateCouponCode } from "@/app/lib/coupons";

/**
 * Para agendamentos cancelados ou recusados pelo admin: usuário escolhe reembolso direto (Asaas) ou cupom para remarcar.
 */
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { appointmentId, opcao } = body; // opcao: "reembolso" | "cupom"

    if (!appointmentId || !opcao || !["reembolso", "cupom"].includes(opcao)) {
      return NextResponse.json(
        { error: "Informe o ID do agendamento e a opção: reembolso ou cupom." },
        { status: 400 }
      );
    }

    const id = parseInt(String(appointmentId));
    if (isNaN(id)) {
      return NextResponse.json({ error: "ID do agendamento inválido." }, { status: 400 });
    }

    const agendamento = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!agendamento) {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }
    if (agendamento.userId !== user.id) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    if (agendamento.status !== "cancelado" && agendamento.status !== "recusado") {
      return NextResponse.json(
        { error: "Esta opção só está disponível para agendamentos cancelados ou recusados." },
        { status: 400 }
      );
    }

    if (
      opcao === "reembolso" &&
      agendamento.cancelRefundOption === "reembolso" &&
      agendamento.refundProcessedAt
    ) {
      return NextResponse.json({
        message: "Reembolso já registrado anteriormente.",
        opcao: "reembolso",
        alreadyProcessed: true,
      });
    }
    if (opcao === "cupom" && agendamento.cancelRefundOption === "cupom" && agendamento.refundCouponId) {
      const cupomExistente = await prisma.coupon.findUnique({
        where: { id: agendamento.refundCouponId },
        select: { code: true },
      });
      return NextResponse.json({
        message: "Cupom já gerado para esta solicitação.",
        opcao: "cupom",
        couponCode: cupomExistente?.code,
        alreadyProcessed: true,
      });
    }

    if (agendamento.cancelRefundOption && agendamento.cancelRefundOption !== opcao) {
      return NextResponse.json(
        { error: "Você já escolheu outra opção para este cancelamento ou recusa." },
        { status: 400 }
      );
    }

    // Agendamento feito com cupom de plano? (cupom com userPlanId vinculado a este agendamento)
    // Ou cancelado sem pagamento (cupom foi liberado ao cancelar, então tratamos como cupom de plano)
    let cupomPlanoDoAgendamento = await prisma.coupon.findFirst({
      where: { appointmentId: id, userPlanId: { not: null } },
      orderBy: { createdAt: "desc" },
      select: { id: true, serviceType: true, discountType: true, discountValue: true },
    });
    let foiComCupomPlano = !!cupomPlanoDoAgendamento;

    if (foiComCupomPlano && opcao === "reembolso") {
      return NextResponse.json(
        {
          error:
            "Este agendamento foi feito com cupom do plano. Apenas a opção de gerar um novo cupom para remarcar está disponível.",
        },
        { status: 400 }
      );
    }

    // Buscar pagamento: por appointmentId ou por appointmentIds (carrinho)
    let payment = await prisma.payment.findFirst({
      where: {
        userId: user.id,
        status: "approved",
        appointmentId: id,
      },
    });
    if (!payment) {
      const pagamentos = await prisma.payment.findMany({
        where: { userId: user.id, status: "approved" },
      });
      payment = pagamentos.find((p) => {
        if (p.appointmentId === id) return true;
        if (p.appointmentIds == null) return false;
        const ids = Array.isArray(p.appointmentIds) ? p.appointmentIds : (typeof p.appointmentIds === "string" ? JSON.parse(p.appointmentIds) : []);
        return Array.isArray(ids) && ids.includes(id);
      }) ?? null;
    }
    // Fallback: pagamento pode não ter appointmentId (ex.: webhook antigo). Buscar por PaymentMetadata.
    if (!payment) {
      const metas = await prisma.paymentMetadata.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      });
      for (const meta of metas) {
        try {
          const parsed = JSON.parse(meta.metadata || "{}");
          const metaAppId = parsed.appointmentId != null ? parseInt(String(parsed.appointmentId), 10) : null;
          if (metaAppId === id && meta.asaasId) {
            const found = await prisma.payment.findFirst({
              where: { userId: user.id, status: "approved", asaasId: meta.asaasId },
            });
            if (found) {
              payment = found;
              await prisma.payment.update({
                where: { id: found.id },
                data: { appointmentId: id, type: "agendamento" },
              });
              break;
            }
            // Payment não existe no nosso banco mas temos asaasId no metadata: criar registro (valor será reembolsado total pelo Asaas)
            payment = await prisma.payment.create({
              data: {
                userId: user.id,
                amount: 0,
                currency: "BRL",
                status: "approved",
                type: "agendamento",
                asaasId: meta.asaasId,
                appointmentId: id,
              },
            });
            break;
          }
        } catch (_) {}
      }
    }

    // Último recurso para reembolso: buscar cobranças RECEIVED no Asaas por externalReference (userId)
    if (opcao === "reembolso" && (!payment || !payment.asaasId)) {
      try {
        const asaasList = await listAsaasPaymentsReceived(user.id, 30);
        const appointmentCreated = agendamento.createdAt.getTime();
        const twoDaysMs = 48 * 60 * 60 * 1000;
        // Encontrar cobrança cuja data de criação está próxima do agendamento (até 48h antes/depois)
        let best: { id: string; value: number; dateCreated: string } | null = null;
        for (const p of asaasList) {
          const created = new Date(p.dateCreated).getTime();
          if (Math.abs(created - appointmentCreated) <= twoDaysMs) {
            if (!best || Math.abs(created - appointmentCreated) < Math.abs(new Date(best.dateCreated).getTime() - appointmentCreated)) {
              best = { id: p.id, value: p.value, dateCreated: p.dateCreated };
            }
          }
        }
        if (best) {
          let existing = await prisma.payment.findFirst({
            where: { userId: user.id, asaasId: best.id },
          });
          if (existing) {
            await prisma.payment.update({
              where: { id: existing.id },
              data: { appointmentId: id, type: "agendamento", amount: best.value },
            });
            const updated = await prisma.payment.findUnique({ where: { id: existing.id } });
            if (updated) payment = updated;
          } else {
            payment = await prisma.payment.create({
              data: {
                userId: user.id,
                amount: best.value,
                currency: "BRL",
                status: "approved",
                type: "agendamento",
                asaasId: best.id,
                appointmentId: id,
              },
            });
          }
        }
      } catch (asaasErr: any) {
        console.error("[Escolher Reembolso] Fallback Asaas list:", asaasErr);
      }
    }

    // Cancelado/recusado sem pagamento = provavelmente foi com cupom de plano (cupom foi liberado ao cancelar/recusar)
    if (!payment && (agendamento.status === "cancelado" || agendamento.status === "recusado")) {
      foiComCupomPlano = true;
    }
    if (foiComCupomPlano && opcao === "reembolso") {
      return NextResponse.json(
        {
          error:
            "Este agendamento foi feito com cupom do plano. Apenas a opção de gerar um novo cupom para remarcar está disponível.",
        },
        { status: 400 }
      );
    }

    const now = new Date();
    let refundAmount: number = 0;
    let couponCode: string | null = null;

    if (opcao === "reembolso") {
      if (!payment?.asaasId) {
        return NextResponse.json(
          {
            error:
              "Pagamento não encontrado ou sem vínculo com Asaas para reembolso direto. Use a opção \"Cupom para remarcar\" para receber um cupom do mesmo valor.",
          },
          { status: 400 }
        );
      }

      const ids = payment.appointmentIds != null
        ? (Array.isArray(payment.appointmentIds) ? payment.appointmentIds : JSON.parse(String(payment.appointmentIds)))
        : [payment.appointmentId].filter(Boolean);
      refundAmount = payment.amount > 0 && ids.length > 0 ? payment.amount / ids.length : payment.amount;
      const valueToRefund = refundAmount > 0 ? refundAmount : undefined;

      const remoteBefore = await fetchAsaasPayment(payment.asaasId);
      if (remoteBefore && asaasPaymentIsRefundedStatus(remoteBefore.status)) {
        const sync = await prisma.appointment.updateMany({
          where: {
            id,
            cancelRefundOption: null,
            status: { in: ["cancelado", "recusado"] },
          },
          data: { cancelRefundOption: "reembolso", refundProcessedAt: now },
        });
        return NextResponse.json({
          message:
            sync.count > 0
              ? "Pagamento já estava reembolsado no Asaas; registro local foi atualizado."
              : "Reembolso já registrado anteriormente.",
          opcao: "reembolso",
          alreadyProcessed: true,
          refundAmount: refundAmount > 0 ? refundAmount : undefined,
        });
      }

      const reserve = await prisma.appointment.updateMany({
        where: {
          id,
          cancelRefundOption: null,
          status: { in: ["cancelado", "recusado"] },
        },
        data: { cancelRefundOption: "reembolso", refundProcessedAt: now },
      });

      if (reserve.count === 0) {
        const apt2 = await prisma.appointment.findUnique({ where: { id } });
        if (
          apt2?.cancelRefundOption === "reembolso" &&
          apt2.refundProcessedAt
        ) {
          return NextResponse.json({
            message: "Reembolso já registrado anteriormente.",
            opcao: "reembolso",
            alreadyProcessed: true,
          });
        }
        return NextResponse.json(
          {
            error:
              "Não foi possível iniciar o reembolso. Atualize a página ou entre em contato com o suporte.",
          },
          { status: 409 }
        );
      }

      const remoteAfterReserve = await fetchAsaasPayment(payment.asaasId);
      if (remoteAfterReserve && asaasPaymentIsRefundedStatus(remoteAfterReserve.status)) {
        return NextResponse.json({
          message:
            "Pagamento já consta como reembolsado no Asaas após reserva local; nenhuma nova solicitação de estorno foi enviada.",
          opcao: "reembolso",
          alreadyProcessed: true,
          refundAmount: refundAmount > 0 ? refundAmount : undefined,
        });
      }

      try {
        await refundAsaasPayment(
          payment.asaasId,
          valueToRefund,
          `Reembolso de agendamento #${id} (${agendamento.status === "recusado" ? "recusa" : "cancelamento"})`
        );
      } catch (err: any) {
        console.error("[Escolher Reembolso] Erro Asaas:", err);
        await prisma.appointment.updateMany({
          where: { id, cancelRefundOption: "reembolso" },
          data: { cancelRefundOption: null, refundProcessedAt: null },
        });
        return NextResponse.json(
          { error: err.message || "Erro ao processar reembolso no Asaas. Tente a opção cupom." },
          { status: 502 }
        );
      }

      return NextResponse.json({
        message: refundAmount > 0
          ? "Reembolso direto solicitado com sucesso. O valor será creditado em até 5 dias úteis."
          : "Reembolso do valor total da cobrança solicitado no Asaas. O valor será creditado em até 5 dias úteis.",
        opcao: "reembolso",
        refundAmount: refundAmount > 0 ? refundAmount : undefined,
      });
    }

    // opcao === "cupom"
    let code = generateCouponCode();
    let attempts = 0;
    while (attempts < 10) {
      const exists = await prisma.coupon.findUnique({ where: { code } });
      if (!exists) break;
      code = generateCouponCode();
      attempts++;
    }

    const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

    async function amarrarCupomOuIdempotente(couponId: string): Promise<
      | { ok: true }
      | { ok: false; response: ReturnType<typeof NextResponse.json> }
    > {
      const bind = await prisma.appointment.updateMany({
        where: { id, cancelRefundOption: null },
        data: { cancelRefundOption: "cupom", refundCouponId: couponId },
      });
      if (bind.count > 0) return { ok: true };

      const apt3 = await prisma.appointment.findUnique({ where: { id } });
      if (apt3?.cancelRefundOption === "cupom" && apt3.refundCouponId === couponId) {
        const c = await prisma.coupon.findUnique({
          where: { id: couponId },
          select: { code: true },
        });
        return {
          ok: false,
          response: NextResponse.json({
            message: "Cupom já gerado para esta solicitação.",
            opcao: "cupom",
            couponCode: c?.code,
            alreadyProcessed: true,
          }),
        };
      }
      await prisma.coupon.delete({ where: { id: couponId } }).catch(() => {});
      return {
        ok: false,
        response: NextResponse.json(
          { error: "Conflito ao registrar cupom. Atualize a página e tente novamente." },
          { status: 409 }
        ),
      };
    }

    if (foiComCupomPlano) {
      const serviceType = cupomPlanoDoAgendamento?.serviceType || agendamento.tipo || "sessao";
      const coupon = await prisma.coupon.create({
        data: {
          code,
          couponType: "reembolso",
          discountType: "service",
          discountValue: 0,
          serviceType,
          appointmentId: id,
          expiresAt,
        },
      });
      couponCode = coupon.code;
      const ar = await amarrarCupomOuIdempotente(coupon.id);
      if (!ar.ok) return ar.response;
      return NextResponse.json({
        message: `Cupom gerado para remarcar (serviço: ${serviceType}). Use-o ao agendar novamente o mesmo tipo de serviço.`,
        opcao: "cupom",
        couponCode,
        serviceType,
      });
    }

    if (!payment) {
      return NextResponse.json(
        { error: "Pagamento não encontrado para gerar cupom." },
        { status: 400 }
      );
    }
    const ids = payment.appointmentIds != null
      ? (Array.isArray(payment.appointmentIds) ? payment.appointmentIds : JSON.parse(String(payment.appointmentIds)))
      : [payment.appointmentId].filter(Boolean);
    refundAmount = ids.length > 0 ? payment.amount / ids.length : payment.amount;

    const coupon = await prisma.coupon.create({
      data: {
        code,
        couponType: "reembolso",
        discountType: "fixed",
        discountValue: refundAmount,
        appointmentId: id,
        expiresAt,
      },
    });
    couponCode = coupon.code;

    const ar2 = await amarrarCupomOuIdempotente(coupon.id);
    if (!ar2.ok) return ar2.response;

    return NextResponse.json({
      message: "Cupom de reembolso gerado. Use-o ao remarcar seu serviço.",
      opcao: "cupom",
      couponCode,
      refundAmount,
    });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    console.error("[Escolher Reembolso] Erro:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao processar opção." },
      { status: 500 }
    );
  }
}
