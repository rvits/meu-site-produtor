import { prisma } from "@/app/lib/prisma";
import { createDomainCoupon } from "@/app/lib/domain/coupon-domain";

type PlanServiceDef = {
  type: string;
  quantity: number;
  discountType?: string;
  discountValue?: number;
};

const planServices: Record<string, PlanServiceDef[]> = {
  teste: [
    { type: "sessao", quantity: 1 },
    { type: "captacao", quantity: 2 },
    { type: "mix", quantity: 1 },
    { type: "percent_servicos", quantity: 1, discountType: "percent", discountValue: 10 },
  ],
  bronze: [
    { type: "sessao", quantity: 1 },
    { type: "captacao", quantity: 2 },
    { type: "mix", quantity: 1 },
    { type: "percent_servicos", quantity: 1, discountType: "percent", discountValue: 10 },
  ],
  prata: [
    { type: "sessao", quantity: 1 },
    { type: "captacao", quantity: 2 },
    { type: "mix_master", quantity: 1 },
    { type: "beat1", quantity: 1 },
  ],
  ouro: [
    { type: "sessao", quantity: 2 },
    { type: "captacao", quantity: 4 },
    { type: "mix_master", quantity: 2 },
    { type: "beat1", quantity: 2 },
    { type: "percent_servicos", quantity: 1, discountType: "percent", discountValue: 10 },
    { type: "percent_beats", quantity: 1, discountType: "percent", discountValue: 10 },
  ],
};

/**
 * Gera cupons do plano via factory de domínio (OP-02A).
 * Idempotente por paymentId.
 */
export async function generatePlanServiceCoupons(params: {
  userId: string;
  userPlanId: string;
  planId: string;
  planName: string;
  modo: string;
  paymentId?: string;
  isTestPayment?: boolean;
}) {
  const { userId, userPlanId, planId, paymentId, isTestPayment = false } = params;

  const userPlan = await prisma.userPlan.findUnique({
    where: { id: userPlanId },
  });
  if (!userPlan) {
    console.warn(`[Plan Coupons] Plano não encontrado para gerar cupons: ${userPlanId}`);
    return [];
  }

  return prisma.$transaction(async (tx) => {
    if (paymentId) {
      const byPayment = await tx.coupon.findMany({
        where: { paymentId },
        orderBy: { createdAt: "asc" },
      });
      if (byPayment.length > 0) return byPayment;
    }

    const services = planServices[planId.toLowerCase()] || [];
    const agora = new Date();
    const expiresAt = new Date();
    expiresAt.setMonth(agora.getMonth() + 2);
    if (userPlan.endDate) {
      const umMesAposPlano = new Date(userPlan.endDate);
      umMesAposPlano.setMonth(umMesAposPlano.getMonth() + 1);
      if (umMesAposPlano > expiresAt) {
        expiresAt.setTime(umMesAposPlano.getTime());
      }
    }

    const coupons = [];
    for (const service of services) {
      for (let i = 0; i < service.quantity; i++) {
        const isPercentCoupon =
          service.type === "percent_servicos" || service.type === "percent_beats";
        const coupon = await createDomainCoupon(tx, {
          canonicalType: isTestPayment
            ? "TEST"
            : isPercentCoupon
              ? "DISCOUNT"
              : "PLAN",
          discountType: isPercentCoupon ? "percent" : "service",
          discountValue: isPercentCoupon ? (service.discountValue ?? 10) : 0,
          serviceType: service.type,
          userPlanId: userPlan.id,
          paymentId: paymentId ?? null,
          assignedUserId: userId,
          expiresAt,
        });
        coupons.push(coupon);
      }
    }

    return coupons;
  });
}
