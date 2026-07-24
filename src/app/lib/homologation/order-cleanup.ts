/**
 * GO-H7 — Limpeza exclusiva de Pedidos de Homologação (origin HOMOLOGATION).
 * Nunca remove Asaas, MercadoPago ou SimulationProvider (lab).
 */
import { prisma } from "@/app/lib/prisma";
import { HOMOLOGATION_ORIGIN } from "@/app/lib/homologation/create-order";

export type HomologationOrderCleanupResult = {
  payments: number;
  appointments: number;
  services: number;
  coupons: number;
  serviceOrders: number;
  paymentMetadata: number;
};

function isHomologationPayment(row: {
  provider: string | null;
  providerPaymentId: string | null;
  asaasId: string | null;
}): boolean {
  const provider = String(row.provider || "").toUpperCase();
  if (provider === HOMOLOGATION_ORIGIN) return true;
  const pid = String(row.providerPaymentId || "");
  if (pid.startsWith("homo_pay_")) return true;
  const asaas = String(row.asaasId || "");
  return asaas.startsWith("homo_pay_");
}

export async function cleanupHomologationOrders(): Promise<HomologationOrderCleanupResult> {
  const result: HomologationOrderCleanupResult = {
    payments: 0,
    appointments: 0,
    services: 0,
    coupons: 0,
    serviceOrders: 0,
    paymentMetadata: 0,
  };

  const candidates = await prisma.payment.findMany({
    where: {
      OR: [
        { provider: { equals: HOMOLOGATION_ORIGIN, mode: "insensitive" } },
        { providerPaymentId: { startsWith: "homo_pay_" } },
        { asaasId: { startsWith: "homo_pay_" } },
      ],
    },
    select: {
      id: true,
      provider: true,
      providerPaymentId: true,
      asaasId: true,
      appointmentId: true,
      appointmentIds: true,
    },
  });

  const payments = candidates.filter(isHomologationPayment);
  const paymentIds = payments.map((p) => p.id);

  const appointmentIdSet = new Set<number>();
  for (const p of payments) {
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
      select: { appointmentId: true },
    });
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
          { provider: { equals: HOMOLOGATION_ORIGIN, mode: "insensitive" } },
          { providerPaymentId: { startsWith: "homo_pay_" } },
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

  // Appointments órfãos marcados HOMOLOGATION
  const orphanApts = await prisma.appointment.findMany({
    where: {
      OR: [
        { observacoes: { contains: "[HOMOLOGATION]" } },
        { observacoes: { contains: "origin=HOMOLOGATION" } },
        { observacoes: { contains: "Pedido de Homologação" } },
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

  if (paymentIds.length > 0) {
    result.payments += (
      await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } })
    ).count;
  }

  const metas = await prisma.paymentMetadata.findMany({
    where: {
      OR: [
        { asaasId: { startsWith: "homo_pay_" } },
        { metadata: { contains: '"origin":"HOMOLOGATION"' } },
        { metadata: { contains: '"provider":"HOMOLOGATION"' } },
        { metadata: { contains: "Pedido de Homologação" } },
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

  return result;
}
