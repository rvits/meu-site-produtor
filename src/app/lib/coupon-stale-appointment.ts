import { prisma } from "@/app/lib/prisma";

/**
 * Remove vínculo residual appointmentId em cupom ainda não consumido (used=false)
 * quando o agendamento foi cancelado/recusado ou não existe mais.
 * Evita estado “cupom em uso” bloqueando novo fluxo após falhas liberação/corrida.
 */
export async function normalizeStaleCouponAppointmentLink(couponId: string): Promise<void> {
  const c = await prisma.coupon.findUnique({
    where: { id: couponId },
    select: { id: true, used: true, appointmentId: true },
  });
  if (!c || c.used || c.appointmentId == null) return;

  const apt = await prisma.appointment.findUnique({
    where: { id: c.appointmentId },
    select: { status: true },
  });

  if (
    !apt ||
    apt.status === "cancelado" ||
    apt.status === "recusado"
  ) {
    await prisma.coupon.update({
      where: { id: couponId },
      data: {
        appointmentId: null,
        used: false,
        usedAt: null,
        usedBy: null,
      },
    });
  }
}
