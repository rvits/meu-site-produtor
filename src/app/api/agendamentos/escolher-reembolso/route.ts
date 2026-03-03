import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { refundAsaasPayment } from "@/app/lib/asaas-refund";
import { listAsaasPaymentsReceived } from "@/app/lib/asaas-list-payments";
import { generateCouponCode } from "@/app/lib/coupons";

/**
 * Para agendamentos cancelados pelo admin: usuário escolhe reembolso direto (Asaas) ou cupom para remarcar.
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
    if (agendamento.status !== "cancelado") {
      return NextResponse.json(
        { error: "Esta opção só está disponível para agendamentos cancelados." },
        { status: 400 }
      );
    }
    if (agendamento.cancelRefundOption) {
      return NextResponse.json(
        { error: "Você já escolheu a opção para este cancelamento." },
        { status: 400 }
      );
    }

    // Agendamento feito com cupom de plano? (cupom com userPlanId vinculado a este agendamento)
    // Ou cancelado sem pagamento (cupom foi liberado ao cancelar, então tratamos como cupom de plano)
    let cupomPlanoDoAgendamento = await prisma.coupon.findFirst({
      where: { appointmentId: id, userPlanId: { not: null } },
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

    // Cancelado sem pagamento = provavelmente foi com cupom de plano (cupom foi liberado ao cancelar)
    if (!payment && agendamento.status === "cancelado") {
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
      // Valor: se pagamento tem vários agendamentos, reembolsar parte proporcional; se amount for 0, Asaas reembolsa o total
      const ids = payment.appointmentIds != null
        ? (Array.isArray(payment.appointmentIds) ? payment.appointmentIds : JSON.parse(String(payment.appointmentIds)))
        : [payment.appointmentId].filter(Boolean);
      refundAmount = payment.amount > 0 && ids.length > 0 ? payment.amount / ids.length : payment.amount;
      const valueToRefund = refundAmount > 0 ? refundAmount : undefined; // undefined = reembolso total no Asaas
      try {
        await refundAsaasPayment(
          payment.asaasId,
          valueToRefund,
          `Reembolso de cancelamento de agendamento #${id}`
        );
      } catch (err: any) {
        console.error("[Escolher Reembolso] Erro Asaas:", err);
        return NextResponse.json(
          { error: err.message || "Erro ao processar reembolso no Asaas. Tente a opção cupom." },
          { status: 502 }
        );
      }
      await prisma.appointment.update({
        where: { id },
        data: { cancelRefundOption: "reembolso", refundProcessedAt: now },
      });
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

    if (foiComCupomPlano) {
      // Novo cupom com as mesmas regras do cupom de plano (mesmo serviço): funciona como cupom do plano para remarcar
      // Se o cupom original foi liberado no cancelamento, usar tipo do agendamento (ex.: sessao, captacao)
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
      await prisma.appointment.update({
        where: { id },
        data: { cancelRefundOption: "cupom", refundCouponId: coupon.id },
      });
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

    await prisma.appointment.update({
      where: { id },
      data: { cancelRefundOption: "cupom", refundCouponId: coupon.id },
    });

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
