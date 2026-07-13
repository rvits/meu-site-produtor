import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { repairOrphanAppointmentServices } from "@/app/lib/ensure-appointment-services";
import { updateServiceFields } from "@/app/lib/domain/workflow";
import { z } from "zod";

const updateSchema = z.object({
  status: z.string().optional(),
  deliveryAudioUrl: z.string().optional(),
  deliveryAudioFormat: z.enum(["wav", "mp3"]).optional(),
});

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

/**
 * GET puro da autoridade Service.
 * Repair opcional via ?repair=1 (usa ensureServices — sem lógica duplicada de create).
 */
export async function GET(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    let repaired = 0;
    if (searchParams.get("repair") === "1") {
      repaired = await repairOrphanAppointmentServices();
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

    return NextResponse.json({ servicos, repaired }, { headers: NO_STORE });
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

    const result = await updateServiceFields({
      serviceId: id,
      status: validation.data.status,
      deliveryAudioUrl: validation.data.deliveryAudioUrl,
      deliveryAudioFormat: validation.data.deliveryAudioFormat,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.httpStatus });
    }

    return NextResponse.json({
      servico: result.data.servico,
      alreadyProcessed: result.alreadyProcessed,
    });
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
