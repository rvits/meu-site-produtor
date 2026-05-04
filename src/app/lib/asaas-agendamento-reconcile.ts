import { prisma } from "@/app/lib/prisma";
import { normalizeServiceTypeId } from "@/app/lib/service-catalog";

type ItemLine = { id?: string; nome?: string; quantidade?: number };

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

async function loadMetadataForPayment(userId: string, asaasPaymentId: string): Promise<Record<string, any>> {
  let metadata: Record<string, any> = {};
  let paymentMetadata = await prisma.paymentMetadata.findFirst({
    where: { userId, asaasId: asaasPaymentId },
    orderBy: { createdAt: "desc" },
  });
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
    select: { id: true, type: true, appointmentId: true, userId: true },
  });
  if (!pay || pay.type !== "agendamento" || pay.appointmentId == null) {
    if (pay) {
      console.warn("[Reconcile] Ignorado (tipo ou appointmentId):", {
        paymentDbId: params.paymentDbId,
        type: pay.type,
        appointmentId: pay.appointmentId,
      });
    }
    return;
  }

  const appointmentId = pay.appointmentId;
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { userId: true },
  });
  if (!appointment) return;

  const metadata = await loadMetadataForPayment(params.userId, params.asaasPaymentId);
  const { services, beats } = parseItems(metadata);

  const couponCount = await prisma.coupon.count({
    where: { paymentId: pay.id },
  });
  if (couponCount === 0) {
    try {
      const { createCouponsForAgendamentoItems } = await import("@/app/lib/agendamento-payment-coupons");
      await createCouponsForAgendamentoItems({
        userId: pay.userId,
        paymentId: pay.id,
        appointmentId: null,
        services: Array.isArray(services) ? services : [],
        beats: Array.isArray(beats) ? beats : [],
        isTestPayment: !!metadata.isTest,
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

  if (svcCount === 0) {
    try {
      if (Array.isArray(services) && services.length > 0) {
        for (const svc of services) {
          const tipo = normalizeServiceTypeId(String(svc.id || svc.nome || "sessao"));
          const desc =
            [svc.nome, svc.quantidade && svc.quantidade > 1 ? `Qtd: ${svc.quantidade}` : null]
              .filter(Boolean)
              .join(" — ") || tipo;
          for (let q = 0; q < (svc.quantidade || 1); q++) {
            await prisma.service.create({
              data: {
                userId: appointment.userId,
                appointmentId,
                tipo,
                description: desc,
                status: "pendente",
              },
            });
          }
        }
      }
      if (Array.isArray(beats) && beats.length > 0) {
        for (const b of beats) {
          const tipoBeat = normalizeServiceTypeId(String(b.id || b.nome || "beat1"));
          const descBeat =
            [b.nome, b.quantidade && b.quantidade > 1 ? `Qtd: ${b.quantidade}` : null]
              .filter(Boolean)
              .join(" — ") || tipoBeat;
          for (let q = 0; q < (b.quantidade || 1); q++) {
            await prisma.service.create({
              data: {
                userId: appointment.userId,
                appointmentId,
                tipo: tipoBeat,
                description: descBeat,
                status: "pendente",
              },
            });
          }
        }
      }
      console.log("[Reconcile] Serviços recriados para appointmentId:", appointmentId);
    } catch (e) {
      console.error("[Reconcile] Falha ao garantir serviços:", e);
    }
  } else if (svcCount < expected) {
    console.warn(
      `[Reconcile] Serviços incompletos (${svcCount}/${expected}) para agendamento ${appointmentId} — correção manual pode ser necessária`
    );
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
