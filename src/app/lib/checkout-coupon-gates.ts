import { prisma } from "@/app/lib/prisma";
import { isRefundCoupon, isServiceCoupon } from "@/app/lib/domain/coupon-types";

/**
 * Gates mínimos de cupom no checkout (PR-03 / HS-03A).
 * Tipagem via enum canônico — sem includes/startsWith.
 */

export const COUPON_REFUND_USAGE_ERROR =
  "Este cupom está em processo de reembolso e não pode mais ser utilizado.";

export function isCouponRefundLocked(coupon: {
  refundRequestedAt?: Date | string | null;
}): boolean {
  return coupon.refundRequestedAt != null;
}

type CheckoutCouponLike = {
  couponType?: string | null;
  discountType?: string | null;
  serviceType?: string | null;
  paymentId?: string | null;
  userPlanId?: string | null;
};

function isCupomResgateAgendamento(coupon: CheckoutCouponLike): boolean {
  if (coupon.paymentId) return true;
  if (isServiceCoupon(coupon) && coupon.serviceType) return true;
  if (isRefundCoupon(coupon)) return true;
  return false;
}

/** Cupom que pode ser digitado no agendamento comum (promocional / percentual de plano / reembolso em valor). */
export function isCupomPermitidoNoAgendamentoComum(coupon: CheckoutCouponLike): boolean {
  if (isCupomResgateAgendamento(coupon)) return false;
  return true;
}

const PLAN_COUPON_BLOCKED_ERROR =
  "Este cupom pertence a um plano cancelado ou inativado. O reembolso do plano é feito na seção Meus Planos.";

function isPlanCouponBlockedByPlanRefund(plan: {
  status?: string | null;
  refundRequestedAt?: Date | string | null;
  refundProcessedAt?: Date | string | null;
  adminInactiveAt?: Date | string | null;
} | null | undefined): boolean {
  if (!plan) return false;
  if (plan.refundRequestedAt || plan.refundProcessedAt) return true;
  return plan.status === "cancelled" || Boolean(plan.adminInactiveAt);
}

export async function getPlanCouponUsageBlockMessage(coupon: {
  userPlanId?: string | null;
  refundRequestedAt?: Date | string | null;
}): Promise<string | null> {
  if (coupon.refundRequestedAt) {
    return "Este cupom está bloqueado pelo cancelamento ou reembolso do plano.";
  }
  if (!coupon.userPlanId) return null;

  const plan = await prisma.userPlan.findUnique({
    where: { id: coupon.userPlanId },
    select: {
      status: true,
      refundRequestedAt: true,
      refundProcessedAt: true,
      adminInactiveAt: true,
    },
  });

  if (isPlanCouponBlockedByPlanRefund(plan)) {
    return PLAN_COUPON_BLOCKED_ERROR;
  }
  return null;
}
