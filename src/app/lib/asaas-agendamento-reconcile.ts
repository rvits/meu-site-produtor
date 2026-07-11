import { prisma } from "@/app/lib/prisma";
import { createServicesForAppointmentIfMissing } from "@/app/lib/asaas-agendamento-payment-effects";
import { appointmentOperationalFilter } from "@/app/lib/appointment-operational-filter";

type ItemLine = { id?: string; nome?: string; quantidade?: number };

type CarrinhoItemMeta = {
  data?: string;
  hora?: string;
  duracaoMinutos?: number;
  servicos?: ItemLine[];
  beats?: ItemLine[];
};

function parseAppointmentIds(raw: unknown): number[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw.map((id) => Number(id)).filter((id) => Number.isFinite(id));
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id))
        : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseCarrinhoItems(metadata: Record<string, unknown>): CarrinhoItemMeta[] {
  try {
    const raw = metadata.items;
    if (typeof raw === "string") return JSON.parse(raw);
    if (Array.isArray(raw)) return raw;
  } catch {
    return [];
  }
  return [];
}

function parseItems(metadata: Record<string, unknown>): { services: ItemLine[]; beats: ItemLine[] } {
  let services: ItemLine[] = [];
  let beats: ItemLine[] = [];
  try {
    const rawS = metadata.servicos;
    services =
      typeof rawS === "string"
        ? JSON.parse(rawS)
        : Array.isArray(rawS)
          ? rawS
          : [];
  } catch {
    services = [];
  }
  try {
    const rawB = metadata.beats;
    beats =
      typeof rawB === "string"
        ? JSON.parse(rawB)
        : Array.isArray(rawB)
          ? rawB
          : [];
  } catch {
    beats = [];
  }
  return { services, beats };
}

function expectedServiceLines(services: ItemLine[], beats: ItemLine[]): number {
  const arrS = Array.isArray(services) ? services : [];
  const arrB = Array.isArray(beats) ? beats : [];
  const n =
    arrS.reduce((acc, s) => acc + Math.max(1, Number(s.quantidade) || 1), 0) +
    arrB.reduce((acc, b) => acc + Math.max(1, Number(b.quantidade) || 1), 0);
  return n;
}

async function loadMetadataForPayment(
  userId: string,
  asaasPaymentId: string,
  options?: { linkAsaasId?: boolean }
): Promise<Record<string, any>> {
  let metadata: Record<string, any> = {};
  let paymentMetadata = await prisma.paymentMetadata.findFirst({
    where: { userId, asaasId: asaasPaymentId },
    orderBy: { createdAt: "desc" },
  });
  if (!paymentMetadata) {
    paymentMetadata = await prisma.paymentMetadata.findFirst({
      where: {
        userId,
        expiresAt: { gt: new Date() },
        OR: [{ asaasId: null }, { asaasId: asaasPaymentId }],
      },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!paymentMetadata) {
    paymentMetadata = await prisma.paymentMetadata.findFirst({
      where: {
        userId,
        OR: [{ asaasId: null }, { asaasId: asaasPaymentId }],
      },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!paymentMetadata) {
    const twoDaysAgo = new Date();
    twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);
    paymentMetadata = await prisma.paymentMetadata.findFirst({
      where: { userId, createdAt: { gte: twoDaysAgo } },
      orderBy: { createdAt: "desc" },
    });
  }
  if (!paymentMetadata) {
    paymentMetadata = await prisma.paymentMetadata.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }
  if (paymentMetadata) {
    try {
      metadata = JSON.parse(paymentMetadata.metadata || "{}");
    } catch {
      metadata = {};
    }
    if (options?.linkAsaasId && paymentMetadata.asaasId !== asaasPaymentId) {
      await prisma.paymentMetadata.update({
        where: { id: paymentMetadata.id },
        data: { asaasId: asaasPaymentId },
      });
    }
  }
  return metadata;
}

function parsePayloadMetadata(raw: unknown): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === "object" && parsed != null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Resolve metadata para o orquestrador de webhook: payload Asaas → PaymentMetadata → fallback descrição.
 */
export async function resolvePaymentMetadataForWebhook(params: {
  userId: string;
  asaasPaymentId: string;
  paymentMetadata?: unknown;
  description?: string | null;
}): Promise<Record<string, unknown>> {
  let metadata = parsePayloadMetadata(params.paymentMetadata);

  if (Object.keys(metadata).length === 0) {
    metadata = await loadMetadataForPayment(params.userId, params.asaasPaymentId, {
      linkAsaasId: true,
    });
  }

  if (Object.keys(metadata).length === 0 && params.description) {
    const descMatch = params.description.match(/Plano (\w+)/i);
    if (descMatch) {
      metadata = { tipo: "plano", planId: descMatch[1].toLowerCase() };
    }
  }

  if (!metadata.userId) {
    metadata.userId = params.userId;
  }

  return metadata;
}

/**
 * Replay idempotente: quando o webhook já criou Payment mas faltaram cupons/serviços.
 */
export async function reconcileAgendamentoPaymentArtifacts(params: {
  paymentDbId: string;
  userId: string;
  asaasPaymentId: string;
}): Promise<void> {
  const pay = await prisma.payment.findUnique({
    where: { id: params.paymentDbId },
    select: { id: true, type: true, appointmentId: true, appointmentIds: true, userId: true },
  });
  if (!pay || pay.type !== "agendamento") {
    if (pay) {
      console.warn("[Reconcile] Ignorado (tipo inválido):", {
        paymentDbId: params.paymentDbId,
        type: pay.type,
      });
    }
    return;
  }

  const metadata = await loadMetadataForPayment(params.userId, params.asaasPaymentId);

  if (metadata.tipo === "carrinho") {
    const items = parseCarrinhoItems(metadata);
    const aptIds = parseAppointmentIds(pay.appointmentIds);
    if (aptIds.length === 0 && pay.appointmentId != null) {
      aptIds.push(pay.appointmentId);
    }

    let aptIndex = 0;
    for (const item of items) {
      if (!item.data || !item.hora) continue;
      const duracaoMinutos = item.duracaoMinutos ?? 60;
      const dataHoraISO = new Date(`${item.data}T${item.hora}:00`);
      const conflito = await prisma.appointment.findFirst({
        where: {
          ...appointmentOperationalFilter,
          status: { not: "cancelado" },
          ...(aptIds.length > 0 ? { id: { notIn: aptIds } } : {}),
          AND: [
            { data: { lt: new Date(dataHoraISO.getTime() + duracaoMinutos * 60000) } },
            { data: { gte: new Date(dataHoraISO.getTime() - duracaoMinutos * 60000) } },
          ],
        },
        select: { id: true },
      });
      if (conflito) continue;

      const appointmentId = aptIds[aptIndex++];
      if (appointmentId == null) continue;

      await createServicesForAppointmentIfMissing({
        appointmentId,
        userId: pay.userId,
        services: Array.isArray(item.servicos) ? item.servicos : [],
        beats: Array.isArray(item.beats) ? item.beats : [],
        logPrefix: "[Reconcile:Carrinho]",
      });
    }

    console.log("[Reconcile] Carrinho: serviços verificados para paymentId:", pay.id);
    return;
  }

  const { services, beats } = parseItems(metadata);

  if (pay.appointmentId == null) {
    const couponCount = await prisma.coupon.count({ where: { paymentId: pay.id } });
    if (couponCount === 0) {
      try {
        const { createCouponsForAgendamentoItems, isSymbolicAgendamentoCouponStyle } = await import(
          "@/app/lib/agendamento-payment-coupons"
        );
        await createCouponsForAgendamentoItems({
          userId: pay.userId,
          paymentId: pay.id,
          services: Array.isArray(services) ? services : [],
          beats: Array.isArray(beats) ? beats : [],
          isTestPayment: isSymbolicAgendamentoCouponStyle(metadata),
        });
        console.log("[Reconcile] Cupons recriados (pagamento sem agendamento):", pay.id);
      } catch (e) {
        console.error("[Reconcile] Falha ao garantir cupons sem agendamento:", e);
      }
    }
    return;
  }

  const appointmentId = pay.appointmentId;
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { userId: true },
  });
  if (!appointment) return;

  const couponCount = await prisma.coupon.count({
    where: { paymentId: pay.id },
  });
  if (couponCount === 0) {
    try {
      const { createCouponsForAgendamentoItems, isSymbolicAgendamentoCouponStyle } = await import(
        "@/app/lib/agendamento-payment-coupons"
      );
      await createCouponsForAgendamentoItems({
        userId: pay.userId,
        paymentId: pay.id,
        appointmentId: null,
        services: Array.isArray(services) ? services : [],
        beats: Array.isArray(beats) ? beats : [],
        isTestPayment: isSymbolicAgendamentoCouponStyle(metadata),
      });
      console.log("[Reconcile] Cupons recriados para paymentId:", pay.id);
    } catch (e) {
      console.error("[Reconcile] Falha ao garantir cupons:", e);
    }
  }

  const svcCount = await prisma.service.count({
    where: { appointmentId },
  });
  const expected = expectedServiceLines(services, beats);
  if (expected === 0) return;

  if (svcCount < expected) {
    try {
      await createServicesForAppointmentIfMissing({
        appointmentId,
        userId: appointment.userId,
        services: Array.isArray(services) ? services : [],
        beats: Array.isArray(beats) ? beats : [],
        logPrefix: "[Reconcile]",
      });
      const svcAfter = await prisma.service.count({ where: { appointmentId } });
      if (svcAfter > svcCount) {
        console.log("[Reconcile] Serviços recriados para appointmentId:", appointmentId);
      }
    } catch (e) {
      console.error("[Reconcile] Falha ao garantir serviços:", e);
    }
  }

  const cupomCode = metadata.cupomCode as string | undefined;
  if (cupomCode && appointmentId) {
    try {
      const cupom = await prisma.coupon.findUnique({
        where: { code: cupomCode.toUpperCase() },
      });
      if (cupom) {
        const up = await prisma.coupon.updateMany({
          where: {
            id: cupom.id,
            used: false,
          },
          data: {
            used: true,
            usedAt: new Date(),
            usedBy: pay.userId,
            appointmentId,
          },
        });
        if (up.count > 0) {
          console.log("[Reconcile] Cupom de checkout marcado como usado:", cupomCode);
        }
      }
    } catch (e) {
      console.error("[Reconcile] Falha ao processar cupomCode:", e);
    }
  }

  const couponFinal = await prisma.coupon.count({ where: { paymentId: pay.id } });
  const svcFinal = await prisma.service.count({ where: { appointmentId } });
  const expectedLines = expectedServiceLines(services, beats);
  const audit = {
    phase: "reconcile_audit",
    paymentDbId: pay.id,
    appointmentId,
    userId: params.userId,
    asaasPaymentId: params.asaasPaymentId,
    couponsForPayment: couponFinal,
    servicesForAppointment: svcFinal,
    expectedServiceLines: expectedLines,
    metadataHadCupomCode: !!cupomCode,
  };
  if (couponFinal === 0 && expectedLines > 0) {
    console.error("[Reconcile] INTEGRIDADE: pagamento sem cupons gerados", audit);
  }
  if (expectedLines > 0 && svcFinal === 0) {
    console.error("[Reconcile] INTEGRIDADE: agendamento sem serviços após replay", audit);
  }
  if (expectedLines > 0 && svcFinal > 0 && svcFinal < expectedLines) {
    console.error("[Reconcile] INTEGRIDADE: contagem parcial de serviços", audit);
  }
  console.log("[Reconcile] Auditoria:", JSON.stringify(audit));
}
