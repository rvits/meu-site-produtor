import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { ensureServicesForAppointment } from "@/app/lib/ensure-appointment-services";
import { reconcileAppointmentWithServices } from "@/app/lib/appointment-service-sync";

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    const idNum = parseInt(id, 10);
    const agendamento = await prisma.appointment.findUnique({
      where: { id: idNum },
      include: {
        user: {
          select: {
            email: true,
            nomeArtistico: true,
          },
        },
      },
    });

    if (!agendamento) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    if (agendamento.status !== "cancelado") {
      return NextResponse.json(
        { error: "Apenas agendamentos cancelados podem ter o cancelamento revertido" },
        { status: 400 }
      );
    }

    const dataHoraISO = new Date(agendamento.data);
    const duracao = agendamento.duracaoMinutos || 60;

    const conflito = await prisma.appointment.findFirst({
      where: {
        id: { not: idNum },
        status: { in: ["aceito", "confirmado", "em_andamento"] },
        AND: [
          { data: { lt: new Date(dataHoraISO.getTime() + duracao * 60000) } },
          { data: { gte: new Date(dataHoraISO.getTime() - duracao * 60000) } },
        ],
      },
    });

    if (conflito) {
      return NextResponse.json(
        { error: "Este horário não está mais disponível. Já existe outro agendamento aceito neste período." },
        { status: 409 }
      );
    }

    await prisma.appointment.update({
      where: { id: idNum },
      data: {
        status: "aceito",
        cancelReason: null,
        cancelledAt: null,
        cancelRefundOption: null,
        refundProcessedAt: null,
        refundCouponId: null,
      },
    });

    // Service é autoridade operacional: realinhar após reabrir a solicitação
    await ensureServicesForAppointment(idNum);
    await prisma.service.updateMany({
      where: {
        appointmentId: idNum,
        status: { in: ["cancelado", "recusado"] },
      },
      data: { status: "aceito", acceptedAt: new Date() },
    });
    await reconcileAppointmentWithServices(idNum);

    console.log(`[Admin] Cancelamento do agendamento ${id} revertido. Services realinhados.`);

    return NextResponse.json({
      message: "Cancelamento revertido com sucesso",
      agendamento: {
        id: agendamento.id,
        status: "aceito",
      },
    });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    console.error("[Admin] Erro ao reverter cancelamento:", err);
    return NextResponse.json({ error: "Erro ao reverter cancelamento" }, { status: 500 });
  }
}
