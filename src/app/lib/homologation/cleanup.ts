/**
 * GO-H6 — Limpeza segura de dados de Homologação / SimulationProvider.
 * Nunca remove pagamentos Asaas / MercadoPago reais.
 */
import { prisma } from "@/app/lib/prisma";
import { listHomologationRuns } from "@/app/lib/homologation/store";

export type HomologationCleanupResult = {
  payments: number;
  appointments: number;
  services: number;
  coupons: number;
  serviceOrders: number;
  userPlans: number;
  paymentMetadata: number;
  runRecords: number;
};

function isSimulationPayment(row: {
  provider: string | null;
  providerPaymentId: string | null;
  asaasId: string | null;
}): boolean {
  const provider = String(row.provider || "").toUpperCase();
  if (provider === "SIMULATION") return true;
  const pid = String(row.providerPaymentId || "");
  if (pid.startsWith("sim_pay_")) return true;
  const asaas = String(row.asaasId || "");
  return asaas.startsWith("sim_pay_");
}

export async function cleanupHomologationData(): Promise<HomologationCleanupResult> {
  const result: HomologationCleanupResult = {
    payments: 0,
    appointments: 0,
    services: 0,
    coupons: 0,
    serviceOrders: 0,
    userPlans: 0,
    paymentMetadata: 0,
    runRecords: 0,
  };

  const runs = await listHomologationRuns(100);
  const runCouponCodes = new Set<string>();
  const runAptIds = new Set<number>();
  const runPaymentDbIds = new Set<string>();
  for (const run of runs) {
    for (const code of run.couponCodes || []) runCouponCodes.add(code);
    for (const id of run.appointmentIds || []) runAptIds.add(id);
    if (run.paymentDbId) runPaymentDbIds.add(run.paymentDbId);
  }

  if (runCouponCodes.size > 0) {
    const couponsByCode = await prisma.coupon.findMany({
      where: { code: { in: [...runCouponCodes] } },
      select: { id: true, appointmentId: true },
    });
    const couponIds = couponsByCode.map((c) => c.id);
    for (const c of couponsByCode) {
      if (c.appointmentId) runAptIds.add(c.appointmentId);
    }
    if (couponIds.length > 0) {
      await prisma.serviceOrder.updateMany({
        where: { couponId: { in: couponIds } },
        data: { couponId: null },
      });
      result.coupons += (
        await prisma.coupon.deleteMany({ where: { id: { in: couponIds } } })
      ).count;
    }
  }

  const candidates = await prisma.payment.findMany({
    where: {
      OR: [
        { provider: { equals: "SIMULATION", mode: "insensitive" } },
        { providerPaymentId: { startsWith: "sim_pay_" } },
        { asaasId: { startsWith: "sim_pay_" } },
        ...(runPaymentDbIds.size ? [{ id: { in: [...runPaymentDbIds] } }] : []),
      ],
    },
    select: {
      id: true,
      userId: true,
      provider: true,
      providerPaymentId: true,
      asaasId: true,
      appointmentId: true,
      appointmentIds: true,
      type: true,
      planId: true,
    },
  });

  const safePayments = candidates.filter(isSimulationPayment);
  const paymentIds = safePayments.map((p) => p.id);

  const appointmentIdSet = new Set<number>(runAptIds);
  for (const p of safePayments) {
    if (p.appointmentId) appointmentIdSet.add(p.appointmentId);
    let raw: unknown = p.appointmentIds;
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        raw = null;
      }
    }
    if (Array.isArray(raw)) {
      for (const id of raw) {
        const n = Number(id);
        if (Number.isFinite(n)) appointmentIdSet.add(n);
      }
    }
  }

  if (paymentIds.length > 0) {
    const orders = await prisma.serviceOrder.findMany({
      where: { paymentId: { in: paymentIds } },
      select: { appointmentId: true },
    });
    for (const o of orders) {
      if (o.appointmentId) appointmentIdSet.add(o.appointmentId);
    }

    const coupons = await prisma.coupon.findMany({
      where: { paymentId: { in: paymentIds } },
      select: { id: true, appointmentId: true, userPlanId: true },
    });
    const planIds = [
      ...new Set(coupons.map((c) => c.userPlanId).filter((id): id is string => Boolean(id))),
    ];
    for (const c of coupons) {
      if (c.appointmentId) appointmentIdSet.add(c.appointmentId);
    }

    await prisma.serviceOrder.updateMany({
      where: { paymentId: { in: paymentIds } },
      data: { couponId: null, appointmentId: null },
    });
    result.serviceOrders += (
      await prisma.serviceOrder.deleteMany({
        where: { paymentId: { in: paymentIds } },
      })
    ).count;

    result.coupons += (
      await prisma.coupon.deleteMany({
        where: { paymentId: { in: paymentIds } },
      })
    ).count;

    if (planIds.length > 0) {
      await prisma.subscription.deleteMany({ where: { userPlanId: { in: planIds } } });
      result.userPlans += (
        await prisma.userPlan.deleteMany({ where: { id: { in: planIds } } })
      ).count;
    }
  }

  const aptIds = [...appointmentIdSet];
  if (aptIds.length > 0) {
    result.services += (
      await prisma.service.deleteMany({
        where: { appointmentId: { in: aptIds } },
      })
    ).count;

    await prisma.serviceOrder.updateMany({
      where: { appointmentId: { in: aptIds } },
      data: { appointmentId: null },
    });
    await prisma.coupon.updateMany({
      where: { appointmentId: { in: aptIds } },
      data: { appointmentId: null },
    });
    await prisma.payment.updateMany({
      where: {
        appointmentId: { in: aptIds },
        OR: [
          { provider: { equals: "SIMULATION", mode: "insensitive" } },
          { providerPaymentId: { startsWith: "sim_pay_" } },
        ],
      },
      data: { appointmentId: null },
    });

    result.appointments += (
      await prisma.appointment.deleteMany({
        where: { id: { in: aptIds } },
      })
    ).count;
  }

  if (paymentIds.length > 0) {
    result.payments += (
      await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } })
    ).count;
  }

  const metas = await prisma.paymentMetadata.findMany({
    where: {
      OR: [
        { asaasId: { startsWith: "sim_pay_" } },
        { metadata: { contains: '"provider":"SIMULATION"' } },
        { metadata: { contains: "homologationRunId" } },
        { metadata: { contains: "laboratório operacional" } },
      ],
    },
    select: { id: true },
  });
  if (metas.length > 0) {
    result.paymentMetadata += (
      await prisma.paymentMetadata.deleteMany({
        where: { id: { in: metas.map((m) => m.id) } },
      })
    ).count;
  }

  const orphanApts = await prisma.appointment.findMany({
    where: {
      OR: [
        { observacoes: { contains: "homo_" } },
        { observacoes: { contains: "[Homologação]" } },
        { observacoes: { contains: "Homologação cenário" } },
        { observacoes: { contains: "simulação homologação" } },
      ],
    },
    select: { id: true },
  });
  if (orphanApts.length > 0) {
    const ids = orphanApts.map((a) => a.id);
    result.services += (
      await prisma.service.deleteMany({ where: { appointmentId: { in: ids } } })
    ).count;
    await prisma.serviceOrder.deleteMany({ where: { appointmentId: { in: ids } } });
    result.appointments += (
      await prisma.appointment.deleteMany({ where: { id: { in: ids } } })
    ).count;
  }

  result.runRecords = (await prisma.homologationRunRecord.deleteMany({})).count;

  return result;
}
