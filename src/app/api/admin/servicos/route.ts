import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { normalizeServiceTypeId } from "@/app/lib/service-catalog";
import { pickPrimaryCouponForDisplay } from "@/app/lib/coupon-selection";
import { reconcileAppointmentWithServices } from "@/app/lib/appointment-service-sync";
import { validateDeliveryAudioUrl } from "@/app/lib/delivery-url-validation";
import { z } from "zod";

const updateSchema = z.object({
  status: z.string().optional(),
  deliveryAudioUrl: z.string().optional(),
  deliveryAudioFormat: z.enum(["wav", "mp3"]).optional(),
});

function mapAppointmentStatusToServiceStatus(appointmentStatus: string): string {
  if (appointmentStatus === "em_andamento") return "em_andamento";
  if (appointmentStatus === "concluido") return "concluido";
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
      const couponsApt = await prisma.coupon.findMany({
        where: { appointmentId: apt.id },
        select: {
          id: true,
          appointmentId: true,
          serviceType: true,
          paymentId: true,
          userPlanId: true,
          couponType: true,
          createdAt: true,
        },
      });
      const coupon = pickPrimaryCouponForDisplay(couponsApt);
      const tipo = normalizeServiceTypeId(String(coupon?.serviceType || apt.tipo || "sessao"));
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

    const anterior = await prisma.service.findUnique({
      where: { id },
      select: {
        status: true,
        deliveryAudioUrl: true,
        deliveryAudioFormat: true,
        appointmentId: true,
      },
    });

    if (!anterior) {
      return NextResponse.json({ error: "Serviço não encontrado" }, { status: 404 });
    }

    const updateData: any = {};
    if (validation.data.status !== undefined) {
      updateData.status = validation.data.status;
      if (validation.data.status === "aceito") {
        updateData.acceptedAt = new Date();
      }
    }
    if (validation.data.deliveryAudioUrl !== undefined) {
      updateData.deliveryAudioUrl = validation.data.deliveryAudioUrl || null;
    }
    if (validation.data.deliveryAudioFormat !== undefined) {
      updateData.deliveryAudioFormat = validation.data.deliveryAudioFormat || null;
    }

    const novoStatus = validation.data.status ?? anterior.status;
    const wantsProbe =
      process.env.DELIVERY_AUDIO_URL_PROBE === "1" ||
      process.env.DELIVERY_AUDIO_URL_PROBE === "true";

    if (novoStatus === "concluido" && anterior.appointmentId == null) {
      return NextResponse.json(
        {
          error:
            "Este serviço não está vinculado a um agendamento; não é possível concluir com entrega aqui.",
        },
        { status: 400 }
      );
    }

    if (novoStatus === "concluido") {
      const urlMerged =
        (validation.data.deliveryAudioUrl !== undefined
          ? validation.data.deliveryAudioUrl
          : anterior.deliveryAudioUrl) || "";
      const fmtMerged =
        validation.data.deliveryAudioFormat !== undefined
          ? validation.data.deliveryAudioFormat
          : anterior.deliveryAudioFormat;
      const urlTrim = String(urlMerged).trim();
      if (fmtMerged !== "wav" && fmtMerged !== "mp3") {
        return NextResponse.json(
          {
            error:
              "Para concluir o serviço é obrigatório informar uma URL http(s) válida do arquivo de áudio e o formato (wav ou mp3).",
          },
          { status: 400 }
        );
      }
      const urlValidation = await validateDeliveryAudioUrl(urlTrim, { probe: wantsProbe });
      if (!urlValidation.ok) {
        return NextResponse.json({ error: urlValidation.error }, { status: 400 });
      }
      updateData.deliveryAudioUrl = urlTrim;
      updateData.deliveryAudioFormat = fmtMerged;
      updateData.status = "concluido";
    }

    const includeRelations = {
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
    } as const;

    let servico: NonNullable<Awaited<ReturnType<typeof prisma.service.findUnique>>>;

    if (validation.data.status === "concluido") {
      const cnt = await prisma.service.updateMany({
        where: { id, status: { not: "concluido" } },
        data: updateData,
      });
      servico = (await prisma.service.findUnique({
        where: { id },
        include: includeRelations,
      })) as typeof servico;
      if (cnt.count === 0 && anterior.status === "concluido") {
        if (servico?.appointmentId) {
          await reconcileAppointmentWithServices(servico.appointmentId);
        }
        return NextResponse.json({ servico, alreadyProcessed: true });
      }
    } else if (validation.data.status === "em_andamento") {
      const cnt = await prisma.service.updateMany({
        where: { id, status: { in: ["pendente", "aceito"] } },
        data: updateData,
      });
      servico = (await prisma.service.findUnique({
        where: { id },
        include: includeRelations,
      })) as typeof servico;
      if (cnt.count === 0 && anterior.status === "em_andamento") {
        if (servico?.appointmentId) {
          await reconcileAppointmentWithServices(servico.appointmentId);
        }
        return NextResponse.json({ servico, alreadyProcessed: true });
      }
    } else {
      servico = await prisma.service.update({
        where: { id },
        data: updateData,
        include: includeRelations,
      });
    }

    if (!servico) {
      return NextResponse.json({ error: "Serviço não encontrado após atualização" }, { status: 500 });
    }

    if (
      servico.appointmentId &&
      validation.data.status === "concluido"
    ) {
      const abertos = await prisma.service.count({
        where: {
          appointmentId: servico.appointmentId,
          status: { notIn: ["concluido", "cancelado", "recusado"] },
        },
      });
      if (abertos === 0) {
        await prisma.appointment.update({
          where: { id: servico.appointmentId },
          data: { status: "concluido" },
        });
      }
    }

    if (servico.appointmentId) {
      await reconcileAppointmentWithServices(servico.appointmentId);
    }

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
