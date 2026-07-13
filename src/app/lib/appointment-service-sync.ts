import { prisma } from "@/app/lib/prisma";
import {
  deriveAppointmentStatusFromServiceStatuses,
} from "@/app/lib/service-authority";

/**
 * Espelha o status administrativo do Appointment a partir dos Services.
 * Fonte operacional = Service; Appointment apenas agregação da solicitação.
 */
export async function reconcileAppointmentWithServices(appointmentId: number): Promise<void> {
  const apt = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { id: true, status: true },
  });
  if (!apt) return;

  const services = await prisma.service.findMany({
    where: { appointmentId },
    select: { status: true },
  });
  if (services.length === 0) return;

  const next = deriveAppointmentStatusFromServiceStatuses(
    apt.status,
    services.map((s) => s.status)
  );
  if (!next || next === apt.status) return;

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: next },
  });
  console.warn(
    `[AppointmentSync] Agendamento ${appointmentId}: espelho admin "${apt.status}" → "${next}" (derivado de Service).`
  );
}
