import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  status: z.string().optional(),
  blocked: z.boolean().optional(),
  blockedReason: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdmin();

    const agendamentos = await prisma.appointment.findMany({
      orderBy: { data: "desc" },
      include: {
        user: {
          select: {
            nomeArtistico: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ agendamentos });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao buscar agendamentos" }, { status: 500 });
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

    const updateData: any = {};
    if (validation.data.status !== undefined) {
      updateData.status = validation.data.status;
    }
    if (validation.data.blocked !== undefined) {
      updateData.blocked = validation.data.blocked;
      if (validation.data.blocked) {
        updateData.blockedAt = new Date();
        updateData.blockedReason = validation.data.blockedReason || "Bloqueado pelo admin";
      } else {
        updateData.blockedAt = null;
        updateData.blockedReason = null;
      }
    }

    const agendamento = await prisma.appointment.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        user: {
          select: {
            nomeArtistico: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json({ agendamento });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao atualizar agendamento" }, { status: 500 });
  }
}
