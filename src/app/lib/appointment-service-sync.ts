import { prisma } from "@/app/lib/prisma";

const TERMINAL = new Set(["concluido", "cancelado", "recusado"]);

function isOpenService(status: string): boolean {
  return !TERMINAL.has(status);
}

/**
 * Corrige divergências óbvias entre Appointment e Services após PATCH em qualquer lado.
 * - appointment concluído com serviços ainda abertos → rebaixa para em_andamento ou aceito
 * - serviços em_andamento com appointment só aceito → promove appointment para em_andamento
 * - todos os serviços terminal com pelo menos um concluído → appointment concluído
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

  if (apt.status === "cancelado" || apt.status === "recusado") {
    return;
  }

  const open = services.filter((s) => isOpenService(s.status));
  const anyEmAndamento = services.some((s) => s.status === "em_andamento");
  const anyAceito = services.some((s) => s.status === "aceito");
  const anyConcluido = services.some((s) => s.status === "concluido");
  const allTerminal = services.every((s) => TERMINAL.has(s.status));
  const allCancelledLike = services.every((s) => s.status === "cancelado" || s.status === "recusado");

  let aptStatus = apt.status;

  if (aptStatus === "pendente" && anyEmAndamento) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "em_andamento" },
    });
    aptStatus = "em_andamento";
    console.warn(
      `[AppointmentSync] Agendamento ${appointmentId} estava pendente com serviço em andamento; promovido para em_andamento.`
    );
  } else if (aptStatus === "pendente" && anyAceito) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "aceito" },
    });
    aptStatus = "aceito";
    console.warn(
      `[AppointmentSync] Agendamento ${appointmentId} estava pendente com serviço aceito; promovido para aceito.`
    );
  }

  if (aptStatus === "concluido" && open.length > 0) {
    const next = anyEmAndamento ? "em_andamento" : "aceito";
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: next },
    });
    console.warn(
      `[AppointmentSync] Agendamento ${appointmentId} estava concluído com serviços abertos; ajustado para "${next}".`
    );
    return;
  }

  if ((aptStatus === "aceito" || aptStatus === "confirmado") && anyEmAndamento) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "em_andamento" },
    });
    return;
  }

  if (
    allTerminal &&
    anyConcluido &&
    !allCancelledLike &&
    aptStatus !== "concluido" &&
    aptStatus !== "cancelado" &&
    aptStatus !== "recusado"
  ) {
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "concluido" },
    });
  }
}
