import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { z } from "zod";
import { sendAppointmentAcceptedEmail, sendAppointmentRejectedEmail } from "@/app/lib/sendEmail";
import { pickPrimaryCouponForDisplay } from "@/app/lib/coupon-selection";
import { releaseBookingCouponsForAppointment } from "@/app/lib/coupon-release";
import { reconcileAppointmentWithServices } from "@/app/lib/appointment-service-sync";

const updateSchema = z.object({
  status: z.string().optional(),
  blocked: z.boolean().optional(),
  blockedReason: z.string().optional(),
  rejectionComment: z.string().optional(), // Comentário editável para recusa
});

export async function GET() {
  try {
    await requireAdmin();

    // Buscar todos os agendamentos (pendente = aguardando aceitar/recusar; aceito/confirmado = aprovados; inclui teste e reais)
    const agendamentos = await prisma.appointment.findMany({
      where: {
        status: {
          in: [
            "pendente",
            "aceito",
            "recusado",
            "confirmado",
            "cancelado",
            "em_andamento",
            "concluido",
          ],
        },
      },
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

    // Buscar todos os pagamentos de agendamento aprovados (para associar inclusive carrinho com appointmentIds)
    const pagamentosAgendamento = await prisma.payment.findMany({
      where: { type: "agendamento", status: "approved", asaasId: { not: null } },
      orderBy: { createdAt: "desc" },
    });

    function pagamentoLigaAoAgendamento(
      p: (typeof pagamentosAgendamento)[0],
      aptId: number
    ): boolean {
      if (p.appointmentId === aptId) return true;
      if (p.appointmentIds == null) return false;
      const ids = Array.isArray(p.appointmentIds)
        ? p.appointmentIds
        : typeof p.appointmentIds === "string"
          ? JSON.parse(p.appointmentIds)
          : [];
      return Array.isArray(ids) && ids.includes(aptId);
    }

    const aptIds = agendamentos.map((a) => a.id);
    const payIds = pagamentosAgendamento.map((p) => p.id);
    let todosCuponsRelacionados: Awaited<ReturnType<typeof prisma.coupon.findMany>> = [];
    if (aptIds.length > 0 || payIds.length > 0) {
      const OR: { appointmentId?: { in: number[] }; paymentId?: { in: string[] } }[] = [];
      if (aptIds.length > 0) OR.push({ appointmentId: { in: aptIds } });
      if (payIds.length > 0) OR.push({ paymentId: { in: payIds } });
      todosCuponsRelacionados = await prisma.coupon.findMany({
        where: { OR },
        orderBy: { createdAt: "asc" },
      });
    }

    const listaCuponsPorAgendamento = (aptId: number): typeof todosCuponsRelacionados => {
      const map = new Map<string, (typeof todosCuponsRelacionados)[0]>();
      for (const c of todosCuponsRelacionados) {
        if (c.appointmentId === aptId) {
          map.set(c.id, c);
          continue;
        }
        if (!c.paymentId) continue;
        const p = pagamentosAgendamento.find((x) => x.id === c.paymentId);
        if (p && pagamentoLigaAoAgendamento(p, aptId)) {
          map.set(c.id, c);
        }
      }
      return [...map.values()].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    };

    const agendamentosComPagamento = agendamentos.map((agendamento) => {
      let pagamento = pagamentosAgendamento.find((p) => p.appointmentId === agendamento.id);
      if (!pagamento && agendamento.userId) {
        pagamento = pagamentosAgendamento.find((p) => {
          if (p.userId !== agendamento.userId) return false;
          return pagamentoLigaAoAgendamento(p, agendamento.id);
        });
      }
      const lista = listaCuponsPorAgendamento(agendamento.id);
      const cupom = pickPrimaryCouponForDisplay(lista);
      return {
        ...agendamento,
        pagamentoConfirmado: pagamento ? {
          id: pagamento.id,
          amount: pagamento.amount,
          status: pagamento.status,
          paymentMethod: pagamento.paymentMethod,
          asaasId: pagamento.asaasId,
          createdAt: pagamento.createdAt,
        } : null,
        cupomAssociado: cupom
          ? {
              id: cupom.id,
              code: cupom.code,
              serviceType: cupom.serviceType,
              discountType: cupom.discountType,
              used: cupom.used,
              couponType: cupom.couponType,
              paymentId: cupom.paymentId,
            }
          : null,
        cuponsAssociados: lista.map((c) => ({
          id: c.id,
          code: c.code,
          serviceType: c.serviceType,
          discountType: c.discountType,
          used: c.used,
          couponType: c.couponType,
          paymentId: c.paymentId,
        })),
      };
    });

    return NextResponse.json({ agendamentos: agendamentosComPagamento });
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

    // Buscar agendamento antes de atualizar para enviar emails
    const agendamentoAntes = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
      include: {
        user: {
          select: {
            nomeArtistico: true,
            email: true,
          },
        },
      },
    });

    if (!agendamentoAntes) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    const idNum = parseInt(id, 10);
    const userInclude = {
      user: {
        select: {
          nomeArtistico: true,
          email: true,
        },
      },
    } as const;

    const rejectionMsg =
      validation.data.status === "recusado"
        ? (validation.data.rejectionComment || "").trim() || "Agendamento recusado."
        : "";

    const statusIncoming = validation.data.status;
    const blockedIncoming = validation.data.blocked;

    const acceptFromPending =
      (statusIncoming === "aceito" || statusIncoming === "confirmado") &&
      agendamentoAntes.status === "pendente" &&
      blockedIncoming === undefined;

    const rejectFromPending =
      statusIncoming === "recusado" &&
      agendamentoAntes.status === "pendente" &&
      blockedIncoming === undefined;

    const startWorkTransition =
      statusIncoming === "em_andamento" &&
      (agendamentoAntes.status === "aceito" || agendamentoAntes.status === "confirmado") &&
      blockedIncoming === undefined;

    let agendamento:
      | (typeof agendamentoAntes & {
          user: { nomeArtistico: string; email: string };
        })
      | null;
    let ranAcceptSideEffects = false;
    let ranRejectSideEffects = false;
    let ranStartSideEffects = false;

    if (acceptFromPending && statusIncoming) {
      const cnt = await prisma.appointment.updateMany({
        where: { id: idNum, status: "pendente" },
        data: { status: statusIncoming },
      });
      if (cnt.count === 0) {
        agendamento = await prisma.appointment.findUnique({
          where: { id: idNum },
          include: userInclude,
        });
        if (
          agendamento &&
          (agendamento.status === "aceito" || agendamento.status === "confirmado")
        ) {
          await reconcileAppointmentWithServices(idNum);
          return NextResponse.json({ agendamento, alreadyProcessed: true });
        }
        return NextResponse.json(
          { error: "Não foi possível aceitar: estado do agendamento mudou. Atualize a lista." },
          { status: 409 }
        );
      }
      ranAcceptSideEffects = true;
      agendamento = await prisma.appointment.findUnique({
        where: { id: idNum },
        include: userInclude,
      });
    } else if (rejectFromPending) {
      const cnt = await prisma.appointment.updateMany({
        where: { id: idNum, status: "pendente" },
        data: {
          status: "recusado",
          cancelReason: rejectionMsg,
          cancelledAt: new Date(),
        },
      });
      if (cnt.count === 0) {
        agendamento = await prisma.appointment.findUnique({
          where: { id: idNum },
          include: userInclude,
        });
        if (agendamento?.status === "recusado") {
          await reconcileAppointmentWithServices(idNum);
          return NextResponse.json({ agendamento, alreadyProcessed: true });
        }
        return NextResponse.json(
          { error: "Não foi possível recusar: estado do agendamento mudou." },
          { status: 409 }
        );
      }
      ranRejectSideEffects = true;
      agendamento = await prisma.appointment.findUnique({
        where: { id: idNum },
        include: userInclude,
      });
    } else if (startWorkTransition) {
      const cnt = await prisma.appointment.updateMany({
        where: { id: idNum, status: { in: ["aceito", "confirmado"] } },
        data: { status: "em_andamento" },
      });
      if (cnt.count === 0) {
        agendamento = await prisma.appointment.findUnique({
          where: { id: idNum },
          include: userInclude,
        });
        if (agendamento?.status === "em_andamento") {
          await prisma.service.updateMany({
            where: {
              appointmentId: idNum,
              status: { in: ["aceito", "pendente"] },
            },
            data: { status: "em_andamento" },
          });
          await reconcileAppointmentWithServices(idNum);
          return NextResponse.json({ agendamento, alreadyProcessed: true });
        }
        return NextResponse.json(
          { error: "Não foi possível iniciar: agendamento não está aceito/confirmado." },
          { status: 409 }
        );
      }
      ranStartSideEffects = true;
      agendamento = await prisma.appointment.findUnique({
        where: { id: idNum },
        include: userInclude,
      });
    } else {
      const updateData: Record<string, unknown> = {};
      if (validation.data.status !== undefined) {
        updateData.status = validation.data.status;
      }
      if (validation.data.status === "recusado") {
        updateData.cancelReason = rejectionMsg;
        updateData.cancelledAt = new Date();
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

      agendamento = await prisma.appointment.update({
        where: { id: idNum },
        data: updateData as any,
        include: userInclude,
      });
    }

    if (!agendamento) {
      return NextResponse.json({ error: "Agendamento não encontrado após atualização." }, { status: 500 });
    }

    try {
      if (ranAcceptSideEffects) {
        await prisma.service.updateMany({
          where: { appointmentId: idNum },
          data: { status: "aceito", acceptedAt: new Date() },
        });

        await prisma.coupon.updateMany({
          where: {
            appointmentId: idNum,
            used: false,
            paymentId: null,
            couponType: { not: "reembolso" },
          },
          data: {
            used: true,
            usedAt: new Date(),
            usedBy: agendamento.userId,
          },
        });

        await sendAppointmentAcceptedEmail(
          agendamento.user.email,
          agendamento.user.nomeArtistico,
          agendamento.data,
          agendamento.tipo
        );
        console.log(`[Admin] Email de aceitação enviado para ${agendamento.user.email}`);
      }

      if (ranStartSideEffects) {
        await prisma.service.updateMany({
          where: {
            appointmentId: idNum,
            status: { in: ["aceito", "pendente"] },
          },
          data: { status: "em_andamento" },
        });
      }

      if (ranRejectSideEffects) {
        await prisma.service.updateMany({
          where: { appointmentId: idNum },
          data: { status: "recusado" },
        });

        await releaseBookingCouponsForAppointment(idNum);

        const rejectionComment =
          agendamento.cancelReason ||
          validation.data.rejectionComment ||
          "Agendamento recusado.";

        await sendAppointmentRejectedEmail(
          agendamento.user.email,
          agendamento.user.nomeArtistico,
          rejectionComment,
          undefined
        );
        console.log(`[Admin] Email de recusa enviado para ${agendamento.user.email}`);
      }
    } catch (emailError: any) {
      console.error("[Admin] Erro ao enviar emails ou efeitos (não crítico):", emailError);
    }

    await reconcileAppointmentWithServices(idNum);

    return NextResponse.json({ agendamento });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao atualizar agendamento" }, { status: 500 });
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

    const agendamento = await prisma.appointment.findUnique({
      where: { id: parseInt(id) },
    });

    if (!agendamento) {
      return NextResponse.json({ error: "Agendamento não encontrado" }, { status: 404 });
    }

    // Só permite excluir agendamentos recusados ou cancelados
    if (agendamento.status !== "recusado" && agendamento.status !== "cancelado") {
      return NextResponse.json(
        { error: "Apenas agendamentos recusados ou cancelados podem ser excluídos" },
        { status: 400 }
      );
    }

    await prisma.appointment.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "Agendamento excluído com sucesso" });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao excluir agendamento" }, { status: 500 });
  }
}
