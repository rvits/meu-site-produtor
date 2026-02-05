import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    const agendamento = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
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

    // Só pode reverter cancelamento de agendamentos cancelados
    if (agendamento.status !== "cancelado") {
      return NextResponse.json(
        { error: "Apenas agendamentos cancelados podem ter o cancelamento revertido" },
        { status: 400 }
      );
    }

    // Verificar se o horário ainda está disponível
    const dataHoraISO = new Date(agendamento.data);
    const duracao = agendamento.duracaoMinutos || 60;

    const conflito = await prisma.appointment.findFirst({
      where: {
        id: { not: parseInt(id) }, // Excluir o próprio agendamento
        status: { in: ["aceito", "confirmado"] }, // Apenas agendamentos aceitos ocupam horário
        AND: [
          { data: { lt: new Date(dataHoraISO.getTime() + (duracao * 60000)) } },
          { data: { gte: new Date(dataHoraISO.getTime() - (duracao * 60000)) } },
        ],
      },
    });

    if (conflito) {
      return NextResponse.json(
        { error: "Este horário não está mais disponível. Já existe outro agendamento aceito neste período." },
        { status: 409 }
      );
    }

    // Reverter cancelamento: voltar para status "aceito"
    // O horário será reservado novamente porque o status volta a ser "aceito"
    await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: {
        status: "aceito",
      },
    });

    console.log(`[Admin] Cancelamento do agendamento ${id} revertido. Horário reservado novamente.`);

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
