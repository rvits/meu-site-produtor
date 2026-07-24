import { prisma } from "@/app/lib/prisma";
import { createDomainCoupon } from "@/app/lib/domain/coupon-domain";
import { expandLineToAtomicServiceTypes } from "@/app/lib/service-orders/expand";
import { createServiceOrdersWithCoupons } from "@/app/lib/service-orders/persist";

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
 * Gera cupons do plano via factory de domínio (OP-02A / GO-H5).
 * Produtos compostos (ex. mix_master) viram Ordens atômicas.
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
    const serviceLines: { id: string; quantidade: number }[] = [];

    for (const service of services) {
      const isPercentCoupon =
        service.type === "percent_servicos" || service.type === "percent_beats";

      if (isPercentCoupon) {
        for (let i = 0; i < service.quantity; i++) {
          const coupon = await createDomainCoupon(tx, {
            canonicalType: isTestPayment ? "TEST" : "DISCOUNT",
            discountType: "percent",
            discountValue: service.discountValue ?? 10,
            serviceType: service.type,
            userPlanId: userPlan.id,
            paymentId: paymentId ?? null,
            assignedUserId: userId,
            expiresAt,
          });
          coupons.push(coupon);
        }
        continue;
      }

      // GO-H5: expandir produto comercial → Ordens atômicas
      const atomics = expandLineToAtomicServiceTypes(service.type, service.quantity);
      serviceLines.push({ id: service.type, quantidade: service.quantity });
      for (const serviceType of atomics) {
        const coupon = await createDomainCoupon(tx, {
          canonicalType: isTestPayment ? "TEST" : "PLAN",
          discountType: "service",
          discountValue: 0,
          serviceType,
          userPlanId: userPlan.id,
          paymentId: paymentId ?? null,
          assignedUserId: userId,
          expiresAt,
        });
        coupons.push(coupon);
      }
    }

    if (paymentId && serviceLines.length > 0) {
      await createServiceOrdersWithCoupons({
        db: tx,
        userId,
        paymentId,
        services: serviceLines,
        beats: [],
        coupons: coupons.filter((c) => c.discountType === "service"),
      });
    }

    return coupons;
  });
}
