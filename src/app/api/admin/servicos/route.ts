import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  status: z.string().optional(),
});

function mapAppointmentStatusToServiceStatus(appointmentStatus: string): string {
  if (appointmentStatus === "aceito" || appointmentStatus === "confirmado") return "aceito";
  if (appointmentStatus === "cancelado") return "cancelado";
  if (appointmentStatus === "recusado") return "recusado";
  return "pendente";
}

export async function GET() {
  try {
    await requireAdmin();

    // Backfill: agendamentos que ainda não têm nenhum serviço vinculado (ex.: criados com cupom antes desta feature)
    const appointmentIdsComServico = await prisma.service.findMany({
      where: { appointmentId: { not: null } },
      select: { appointmentId: true },
      distinct: ["appointmentId"],
    });
    const idsComServico = appointmentIdsComServico
      .map((s) => s.appointmentId)
      .filter((id): id is number => id != null);

    const appointmentsSemServicos = await prisma.appointment.findMany({
      where: { id: { notIn: idsComServico.length > 0 ? idsComServico : [0] } },
      include: {
        user: { select: { id: true } },
      },
    });

    for (const apt of appointmentsSemServicos) {
      const coupon = await prisma.coupon.findFirst({
        where: { appointmentId: apt.id },
        select: { serviceType: true },
      });
      const tipo = coupon?.serviceType || apt.tipo;
      const description = `Agendamento ${tipo}`;
      const status = mapAppointmentStatusToServiceStatus(apt.status);
      try {
        await prisma.service.create({
          data: {
            userId: apt.userId,
            appointmentId: apt.id,
            tipo,
            description,
            status,
            ...(status === "aceito" ? { acceptedAt: new Date() } : {}),
          },
        });
      } catch (e) {
        console.warn("[Admin Serviços] Backfill skip agendamento", apt.id, e);
      }
    }

    const servicos = await prisma.service.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            nomeArtistico: true,
            email: true,
          },
        },
        appointment: {
          select: {
            id: true,
            data: true,
            status: true,
            tipo: true,
          },
        },
      },
    });

    return NextResponse.json({ servicos });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao buscar serviços" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    const body = await req.json();
    const validation = updateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }

    const updateData: any = { status: validation.data.status };
    if (validation.data.status === "aceito") {
      updateData.acceptedAt = new Date();
    }

    const servico = await prisma.service.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            nomeArtistico: true,
            email: true,
          },
        },
        appointment: {
          select: {
            id: true,
            data: true,
            status: true,
            tipo: true,
          },
        },
      },
    });

    return NextResponse.json({ servico });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao atualizar serviço" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    await prisma.service.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: "Serviço excluído com sucesso." });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao excluir serviço" }, { status: 500 });
  }
}
