import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { z } from "zod";

const updateSchema = z.object({
  status: z.string().optional(),
});

export async function GET() {
  try {
    await requireAdmin();

    const servicos = await prisma.service.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            nomeArtistico: true,
            email: true,
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
