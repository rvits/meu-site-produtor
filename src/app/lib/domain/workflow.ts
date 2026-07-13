/**
 * HS-03A — Workflow oficial de transições.
 * Rotas NÃO devem alterar Appointment.status / Service.status diretamente.
 */

import { prisma } from "@/app/lib/prisma";
import { ensureServicesForAppointment } from "@/app/lib/ensure-appointment-services";
import { reconcileAppointmentWithServices } from "@/app/lib/appointment-service-sync";
import { releaseBookingCouponsForAppointment } from "@/app/lib/coupon-release";
import { validateDeliveryAudioUrl } from "@/app/lib/delivery-url-validation";
import {
  DomainError,
  canApproveAppointment,
  canCancelAppointment,
  canRejectAppointment,
  canStartService,
  assertServiceTransition,
} from "@/app/lib/domain/domain-service";
import { TERMINAL_SERVICE_STATUSES } from "@/app/lib/domain/statuses";
import { toPersistedCouponType } from "@/app/lib/domain/coupon-types";

export type WorkflowOk<T> = { ok: true; alreadyProcessed?: boolean; data: T };
export type WorkflowFail = { ok: false; error: string; httpStatus: number; code?: string };
export type WorkflowResult<T> = WorkflowOk<T> | WorkflowFail;

function fail(error: string, httpStatus: number, code?: string): WorkflowFail {
  return { ok: false, error, httpStatus, code };
}

function ok<T>(data: T, alreadyProcessed?: boolean): WorkflowOk<T> {
  return { ok: true, data, alreadyProcessed };
}

const aptUserInclude = {
  user: { select: { nomeArtistico: true, email: true } },
} as const;

const serviceInclude = {
  user: { select: { nomeArtistico: true, email: true } },
  appointment: { select: { id: true, data: true, status: true, tipo: true } },
} as const;

export async function approveAppointment(
  appointmentId: number,
  statusLabel: "aceito" | "confirmado" = "aceito"
): Promise<
  WorkflowResult<{
    agendamento: NonNullable<Awaited<ReturnType<typeof prisma.appointment.findUnique>>>;
  }>
> {
  const before = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: aptUserInclude,
  });
  if (!before) return fail("Agendamento não encontrado", 404, "NOT_FOUND");
  if (!canApproveAppointment(before.status)) {
    if (before.status === "aceito" || before.status === "confirmado") {
      await reconcileAppointmentWithServices(appointmentId);
      return ok({ agendamento: before }, true);
    }
    return fail("Não é possível aceitar neste estado", 409, "INVALID_TRANSITION");
  }

  const cnt = await prisma.appointment.updateMany({
    where: { id: appointmentId, status: "pendente" },
    data: { status: statusLabel },
  });
  if (cnt.count === 0) {
    const cur = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: aptUserInclude,
    });
    if (cur && (cur.status === "aceito" || cur.status === "confirmado")) {
      await reconcileAppointmentWithServices(appointmentId);
      return ok({ agendamento: cur }, true);
    }
    return fail("Estado do agendamento mudou. Atualize a lista.", 409, "CONFLICT");
  }

  await ensureServicesForAppointment(appointmentId);
  await prisma.service.updateMany({
    where: { appointmentId },
    data: { status: "aceito", acceptedAt: new Date() },
  });

  await prisma.coupon.updateMany({
    where: {
      appointmentId,
      used: false,
      paymentId: null,
      couponType: { not: toPersistedCouponType("REFUND") },
    },
    data: {
      used: true,
      usedAt: new Date(),
      usedBy: before.userId,
    },
  });

  await reconcileAppointmentWithServices(appointmentId);
  const agendamento = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: aptUserInclude,
  });
  if (!agendamento) return fail("Agendamento não encontrado após aceite", 500);
  return ok({ agendamento });
}

export async function rejectAppointment(
  appointmentId: number,
  reason: string
): Promise<
  WorkflowResult<{
    agendamento: NonNullable<Awaited<ReturnType<typeof prisma.appointment.findUnique>>>;
  }>
> {
  const before = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: aptUserInclude,
  });
  if (!before) return fail("Agendamento não encontrado", 404, "NOT_FOUND");
  if (!canRejectAppointment(before.status)) {
    if (before.status === "recusado") {
      await reconcileAppointmentWithServices(appointmentId);
      return ok({ agendamento: before }, true);
    }
    return fail("Não é possível recusar neste estado", 409, "INVALID_TRANSITION");
  }

  const cnt = await prisma.appointment.updateMany({
    where: { id: appointmentId, status: "pendente" },
    data: {
      status: "recusado",
      cancelReason: reason,
      cancelledAt: new Date(),
    },
  });
  if (cnt.count === 0) {
    const cur = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: aptUserInclude,
    });
    if (cur?.status === "recusado") {
      await reconcileAppointmentWithServices(appointmentId);
      return ok({ agendamento: cur }, true);
    }
    return fail("Estado do agendamento mudou.", 409, "CONFLICT");
  }

  await prisma.service.updateMany({
    where: { appointmentId },
    data: { status: "recusado" },
  });
  await releaseBookingCouponsForAppointment(appointmentId);
  await reconcileAppointmentWithServices(appointmentId);

  const agendamento = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: aptUserInclude,
  });
  if (!agendamento) return fail("Agendamento não encontrado após recusa", 500);
  return ok({ agendamento });
}

export async function startServiceWork(
  appointmentId: number
): Promise<
  WorkflowResult<{
    agendamento: NonNullable<Awaited<ReturnType<typeof prisma.appointment.findUnique>>>;
  }>
> {
  const before = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: aptUserInclude,
  });
  if (!before) return fail("Agendamento não encontrado", 404, "NOT_FOUND");

  const cnt = await prisma.appointment.updateMany({
    where: { id: appointmentId, status: { in: ["aceito", "confirmado"] } },
    data: { status: "em_andamento" },
  });

  if (cnt.count === 0) {
    if (before.status === "em_andamento") {
      await prisma.service.updateMany({
        where: { appointmentId, status: { in: ["aceito", "pendente"] } },
        data: { status: "em_andamento" },
      });
      await reconcileAppointmentWithServices(appointmentId);
      return ok({ agendamento: before }, true);
    }
    return fail("Agendamento não está aceito/confirmado.", 409, "INVALID_TRANSITION");
  }

  await prisma.service.updateMany({
    where: { appointmentId, status: { in: ["aceito", "pendente"] } },
    data: { status: "em_andamento" },
  });
  await reconcileAppointmentWithServices(appointmentId);

  const agendamento = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: aptUserInclude,
  });
  if (!agendamento) return fail("Agendamento não encontrado após início", 500);
  return ok({ agendamento });
}

export async function cancelAppointment(params: {
  appointmentId: number;
  actor: "admin" | "user";
  userId?: string;
  reason?: string;
}): Promise<
  WorkflowResult<{
    agendamento: { id: number; status: string };
    releasedCoupons: number;
  }>
> {
  const { appointmentId, actor, userId, reason } = params;
  const before = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!before) return fail("Agendamento não encontrado", 404, "NOT_FOUND");

  if (actor === "user" && userId && before.userId !== userId) {
    return fail("Acesso negado", 403, "FORBIDDEN");
  }

  if (before.status === "cancelado") {
    return ok(
      { agendamento: { id: before.id, status: "cancelado" }, releasedCoupons: 0 },
      true
    );
  }

  if (before.status === "recusado" && actor === "admin") {
    return fail(
      "Agendamento já foi recusado; não é possível cancelar novamente por este fluxo.",
      400,
      "INVALID_TRANSITION"
    );
  }

  if (!canCancelAppointment(before.status, actor)) {
    return fail(
      actor === "user"
        ? "Apenas agendamentos aceitos ou em andamento podem ser cancelados por aqui"
        : "Não é possível cancelar no estado atual.",
      400,
      "INVALID_TRANSITION"
    );
  }

  if (actor === "admin" && (!reason || reason.trim().length < 3)) {
    return fail("Justificativa do cancelamento é obrigatória (mínimo 3 caracteres).", 400);
  }

  const whereStatus =
    actor === "user"
      ? { in: ["aceito", "confirmado", "em_andamento"] as const }
      : { notIn: ["cancelado", "recusado"] as const };

  const data: {
    status: "cancelado";
    cancelReason?: string;
    cancelledAt?: Date;
  } = { status: "cancelado" };
  if (actor === "admin") {
    data.cancelReason = reason!.trim();
    data.cancelledAt = new Date();
  }

  const rows = await prisma.appointment.updateMany({
    where: { id: appointmentId, status: whereStatus as any, ...(actor === "user" && userId ? { userId } : {}) },
    data,
  });

  if (rows.count === 0) {
    const cur = await prisma.appointment.findUnique({ where: { id: appointmentId } });
    if (cur?.status === "cancelado") {
      return ok(
        { agendamento: { id: cur.id, status: "cancelado" }, releasedCoupons: 0 },
        true
      );
    }
    return fail("Não foi possível cancelar o agendamento no estado atual.", 409, "CONFLICT");
  }

  await prisma.service.updateMany({
    where: { appointmentId },
    data: { status: "cancelado" },
  });
  const releasedCoupons = await releaseBookingCouponsForAppointment(appointmentId);
  await reconcileAppointmentWithServices(appointmentId);

  return ok({
    agendamento: { id: appointmentId, status: "cancelado" },
    releasedCoupons,
  });
}

export async function revertAppointmentCancellation(
  appointmentId: number
): Promise<WorkflowResult<{ agendamento: { id: number; status: string } }>> {
  const before = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!before) return fail("Agendamento não encontrado", 404, "NOT_FOUND");
  if (before.status !== "cancelado") {
    return fail("Apenas agendamentos cancelados podem ter o cancelamento revertido", 400);
  }

  const dataHoraISO = new Date(before.data);
  const duracao = before.duracaoMinutos || 60;
  const conflito = await prisma.appointment.findFirst({
    where: {
      id: { not: appointmentId },
      status: { in: ["aceito", "confirmado", "em_andamento"] },
      AND: [
        { data: { lt: new Date(dataHoraISO.getTime() + duracao * 60000) } },
        { data: { gte: new Date(dataHoraISO.getTime() - duracao * 60000) } },
      ],
    },
  });
  if (conflito) {
    return fail(
      "Este horário não está mais disponível. Já existe outro agendamento aceito neste período.",
      409,
      "CONFLICT"
    );
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: "aceito",
      cancelReason: null,
      cancelledAt: null,
      cancelRefundOption: null,
      refundProcessedAt: null,
      refundCouponId: null,
    },
  });

  await ensureServicesForAppointment(appointmentId);
  await prisma.service.updateMany({
    where: { appointmentId, status: { in: ["cancelado", "recusado"] } },
    data: { status: "aceito", acceptedAt: new Date() },
  });
  await reconcileAppointmentWithServices(appointmentId);

  return ok({ agendamento: { id: appointmentId, status: "aceito" } });
}

export async function startService(serviceId: string): Promise<
  WorkflowResult<{
    servico: NonNullable<Awaited<ReturnType<typeof prisma.service.findUnique>>>;
  }>
> {
  const anterior = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!anterior) return fail("Serviço não encontrado", 404, "NOT_FOUND");

  if (anterior.status === "em_andamento") {
    if (anterior.appointmentId) await reconcileAppointmentWithServices(anterior.appointmentId);
    const servico = await prisma.service.findUnique({
      where: { id: serviceId },
      include: serviceInclude,
    });
    return ok({ servico: servico! }, true);
  }

  try {
    assertServiceTransition(anterior.status, "em_andamento");
  } catch (e) {
    if (e instanceof DomainError) return fail(e.message, e.httpStatus, e.code);
    throw e;
  }

  if (!canStartService(anterior.status)) {
    return fail(`Não é possível iniciar serviço a partir de ${anterior.status}`, 409);
  }

  const cnt = await prisma.service.updateMany({
    where: { id: serviceId, status: { in: ["pendente", "aceito"] } },
    data: { status: "em_andamento" },
  });
  const servico = await prisma.service.findUnique({
    where: { id: serviceId },
    include: serviceInclude,
  });
  if (!servico) return fail("Serviço não encontrado após atualização", 500);
  if (cnt.count === 0) return fail("Não foi possível iniciar o serviço", 409, "CONFLICT");

  if (servico.appointmentId) {
    await reconcileAppointmentWithServices(servico.appointmentId);
  }
  return ok({ servico });
}

export async function completeService(params: {
  serviceId: string;
  deliveryAudioUrl: string;
  deliveryAudioFormat: "wav" | "mp3";
  probe?: boolean;
}): Promise<
  WorkflowResult<{
    servico: NonNullable<Awaited<ReturnType<typeof prisma.service.findUnique>>>;
  }>
> {
  const { serviceId, deliveryAudioUrl, deliveryAudioFormat, probe } = params;
  const anterior = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!anterior) return fail("Serviço não encontrado", 404, "NOT_FOUND");

  if (anterior.appointmentId == null) {
    return fail(
      "Este serviço não está vinculado a um agendamento; não é possível concluir com entrega aqui.",
      400
    );
  }

  if (anterior.status === "concluido") {
    await reconcileAppointmentWithServices(anterior.appointmentId);
    const servico = await prisma.service.findUnique({
      where: { id: serviceId },
      include: serviceInclude,
    });
    return ok({ servico: servico! }, true);
  }

  const urlTrim = String(deliveryAudioUrl || "").trim();
  if (deliveryAudioFormat !== "wav" && deliveryAudioFormat !== "mp3") {
    return fail(
      "Para concluir o serviço é obrigatório informar uma URL http(s) válida do arquivo de áudio e o formato (wav ou mp3).",
      400
    );
  }
  const urlValidation = await validateDeliveryAudioUrl(urlTrim, { probe: Boolean(probe) });
  if (!urlValidation.ok) {
    return fail(urlValidation.error || "URL de entrega inválida", 400);
  }

  const cnt = await prisma.service.updateMany({
    where: { id: serviceId, status: { not: "concluido" } },
    data: {
      status: "concluido",
      deliveryAudioUrl: urlTrim,
      deliveryAudioFormat,
    },
  });

  const servico = await prisma.service.findUnique({
    where: { id: serviceId },
    include: serviceInclude,
  });
  if (!servico) return fail("Serviço não encontrado após conclusão", 500);

  if (cnt.count === 0 && anterior.status === "concluido") {
    await reconcileAppointmentWithServices(servico.appointmentId!);
    return ok({ servico }, true);
  }

  const abertos = await prisma.service.count({
    where: {
      appointmentId: servico.appointmentId!,
      status: { notIn: [...TERMINAL_SERVICE_STATUSES] },
    },
  });
  if (abertos === 0) {
    await prisma.appointment.update({
      where: { id: servico.appointmentId! },
      data: { status: "concluido" },
    });
  }

  await reconcileAppointmentWithServices(servico.appointmentId!);
  return ok({ servico });
}

/** Alias de completeService — entrega + conclusão. */
export const deliverService = completeService;

export async function updateServiceFields(params: {
  serviceId: string;
  status?: string;
  deliveryAudioUrl?: string | null;
  deliveryAudioFormat?: "wav" | "mp3" | null;
}): Promise<
  WorkflowResult<{
    servico: NonNullable<Awaited<ReturnType<typeof prisma.service.findUnique>>>;
  }>
> {
  const { serviceId, status, deliveryAudioUrl, deliveryAudioFormat } = params;

  if (status === "em_andamento") {
    return startService(serviceId);
  }
  if (status === "concluido") {
    return completeService({
      serviceId,
      deliveryAudioUrl: deliveryAudioUrl || "",
      deliveryAudioFormat: (deliveryAudioFormat as "wav" | "mp3") || "wav",
      probe:
        process.env.DELIVERY_AUDIO_URL_PROBE === "1" ||
        process.env.DELIVERY_AUDIO_URL_PROBE === "true",
    });
  }

  const anterior = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!anterior) return fail("Serviço não encontrado", 404, "NOT_FOUND");

  const updateData: Record<string, unknown> = {};
  if (status !== undefined) {
    updateData.status = status;
    if (status === "aceito") updateData.acceptedAt = new Date();
  }
  if (deliveryAudioUrl !== undefined) updateData.deliveryAudioUrl = deliveryAudioUrl || null;
  if (deliveryAudioFormat !== undefined) {
    updateData.deliveryAudioFormat = deliveryAudioFormat || null;
  }

  const servico = await prisma.service.update({
    where: { id: serviceId },
    data: updateData,
    include: serviceInclude,
  });

  if (servico.appointmentId) {
    await reconcileAppointmentWithServices(servico.appointmentId);
  }
  return ok({ servico });
}
