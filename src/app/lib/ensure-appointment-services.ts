import { prisma } from "@/app/lib/prisma";
import {
  createServicesForAppointmentIfMissing,
  parseAgendamentoMetadataItems,
} from "@/app/lib/asaas-agendamento-payment-effects";
import { pickPrimaryCouponForDisplay } from "@/app/lib/coupon-selection";
import { normalizeServiceTypeId } from "@/app/lib/service-catalog";
import { parsePaymentAppointmentIds } from "@/app/lib/symbolic-payment";

/**
 * Garante que um agendamento aceito tenha ao menos um Service vinculado.
 * Idempotente — não duplica linhas existentes.
 */
export async function ensureServicesForAppointment(appointmentId: number): Promise<number> {
  const existing = await prisma.service.count({ where: { appointmentId } });
  if (existing > 0) return 0;

  const apt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, userId: true, tipo: true, status: true },
  });
  if (!apt) return 0;

  const payments = await prisma.payment.findMany({
    where: {
      userId: apt.userId,
      status: "approved",
      type: "agendamento",
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      appointmentId: true,
      appointmentIds: true,
      asaasId: true,
    },
  });

  const linkedPayment = payments.find((p) =>
    parsePaymentAppointmentIds(p).includes(appointmentId)
  );

  if (linkedPayment) {
    const metaRow = linkedPayment.asaasId
      ? await prisma.paymentMetadata.findFirst({
          where: { asaasId: linkedPayment.asaasId },
          orderBy: { createdAt: "desc" },
          select: { metadata: true },
        })
      : null;
    const metadata =
      metaRow?.metadata && typeof metaRow.metadata === "object"
        ? (metaRow.metadata as Record<string, unknown>)
        : {};
    const { services, beats } = parseAgendamentoMetadataItems(metadata);
    if (services.length > 0 || beats.length > 0) {
      return createServicesForAppointmentIfMissing({
        appointmentId,
        userId: apt.userId,
        services,
        beats,
        logPrefix: "[EnsureServices]",
      });
    }
  }

  const coupons = await prisma.coupon.findMany({
    where: { appointmentId },
    select: {
      id: true,
      appointmentId: true,
      serviceType: true,
      paymentId: true,
      userPlanId: true,
      couponType: true,
      createdAt: true,
    },
  });
  const coupon = pickPrimaryCouponForDisplay(coupons);
  const tipo = normalizeServiceTypeId(String(coupon?.serviceType || apt.tipo || "sessao"));

  const mapStatus =
    apt.status === "aceito" || apt.status === "confirmado"
      ? "aceito"
      : apt.status === "em_andamento"
        ? "em_andamento"
        : apt.status === "concluido"
          ? "concluido"
          : "pendente";

  await prisma.service.create({
    data: {
      userId: apt.userId,
      appointmentId,
      tipo,
      description: `Agendamento ${tipo}`,
      status: mapStatus,
      ...(mapStatus === "aceito" ? { acceptedAt: new Date() } : {}),
    },
  });

  return 1;
}
