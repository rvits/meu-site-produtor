/**
 * Extrai sincronização de PAYMENT_REFUNDED do webhook Asaas
 * para reuso pelo SimulationProvider (mesmo efeito de domínio).
 */
import { prisma } from "@/app/lib/prisma";

const USER_PLAN_REFUND_MATCH_WINDOW_MS = 48 * 60 * 60 * 1000;

function parsePaymentAppointmentIds(payment: {
  appointmentId: number | null;
  appointmentIds: unknown;
}): number[] {
  const ids: number[] = [];
  if (payment.appointmentId != null) ids.push(payment.appointmentId);
  let raw = payment.appointmentIds;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  if (Array.isArray(raw)) {
    for (const v of raw) {
      const n = Number(v);
      if (Number.isFinite(n)) ids.push(n);
    }
  }
  return [...new Set(ids)];
}

/**
 * Após estorno confirmado no gateway (Asaas ou Simulation),
 * espelha refundAsaasStatus nas entidades locais.
 */
export async function syncInboundRefundConfirmation(providerPaymentId: string): Promise<{
  appointments: number;
  coupons: number;
  userPlans: number;
}> {
  const localPayment = await prisma.payment.findFirst({
    where: {
      OR: [{ asaasId: providerPaymentId }, { mercadopagoId: providerPaymentId }],
    },
    select: {
      id: true,
      userId: true,
      type: true,
      planId: true,
      createdAt: true,
      appointmentId: true,
      appointmentIds: true,
    },
  });

  if (!localPayment) {
    return { appointments: 0, coupons: 0, userPlans: 0 };
  }

  const appointmentIds = parsePaymentAppointmentIds(localPayment);

  const appointmentsResult =
    appointmentIds.length > 0
      ? await prisma.appointment.updateMany({
          where: {
            id: { in: appointmentIds },
            cancelRefundOption: "reembolso",
            refundProcessedAt: { not: null },
          },
          data: { refundAsaasStatus: "REFUNDED" },
        })
      : { count: 0 };

  const couponOr: Array<{ paymentId: string } | { appointmentId: { in: number[] } }> = [
    { paymentId: localPayment.id },
  ];
  if (appointmentIds.length > 0) {
    couponOr.push({ appointmentId: { in: appointmentIds } });
  }

  const couponsResult = await prisma.coupon.updateMany({
    where: {
      OR: couponOr,
      refundProcessedAt: { not: null },
      refundAsaasStatus: "pending",
    },
    data: { refundAsaasStatus: "confirmed" },
  });

  let userPlansResult = { count: 0 };
  if (localPayment.type === "plano") {
    const pendingPlans = await prisma.userPlan.findMany({
      where: {
        userId: localPayment.userId,
        refundProcessedAt: { not: null },
        refundAsaasStatus: "pending",
        ...(localPayment.planId ? { planId: localPayment.planId } : {}),
      },
      select: { id: true, createdAt: true },
    });

    const planIdsToConfirm =
      pendingPlans.length <= 1
        ? pendingPlans.map((p) => p.id)
        : pendingPlans
            .filter(
              (plan) =>
                Math.abs(plan.createdAt.getTime() - localPayment.createdAt.getTime()) <=
                USER_PLAN_REFUND_MATCH_WINDOW_MS
            )
            .sort(
              (a, b) =>
                Math.abs(a.createdAt.getTime() - localPayment.createdAt.getTime()) -
                Math.abs(b.createdAt.getTime() - localPayment.createdAt.getTime())
            )
            .slice(0, 1)
            .map((p) => p.id);

    if (planIdsToConfirm.length > 0) {
      userPlansResult = await prisma.userPlan.updateMany({
        where: {
          id: { in: planIdsToConfirm },
          refundProcessedAt: { not: null },
          refundAsaasStatus: "pending",
        },
        data: { refundAsaasStatus: "confirmed" },
      });
    }
  }

  return {
    appointments: appointmentsResult.count,
    coupons: couponsResult.count,
    userPlans: userPlansResult.count,
  };
}
