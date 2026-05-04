import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import { sendAppointmentCancelledEmail } from "@/app/lib/sendEmail";
import { releaseBookingCouponsForAppointment } from "@/app/lib/coupon-release";
import { reconcileAppointmentWithServices } from "@/app/lib/appointment-service-sync";

export async function POST(req: Request) {
  try {
    await requireAdmin();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
    }

    // Justificativa é obrigatória para cancelamento pelo admin
    let cancellationComment: string | undefined;
    try {
      const bodyText = await req.text();
      if (bodyText && bodyText.trim()) {
        const body = JSON.parse(bodyText);
        cancellationComment = (body.cancellationComment || "").trim();
      }
    } catch (parseError: any) {
      console.warn("[Admin] Erro ao parsear body do cancelamento:", parseError);
    }
    if (!cancellationComment || cancellationComment.length < 3) {
      return NextResponse.json(
        { error: "Justificativa do cancelamento é obrigatória (mínimo 3 caracteres)." },
        { status: 400 }
      );
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

    const idNum = parseInt(id, 10);

    if (agendamento.status === "cancelado") {
      return NextResponse.json({
        message: "Este agendamento já estava cancelado.",
        alreadyProcessed: true,
        agendamento: { id: agendamento.id, status: "cancelado" },
      });
    }
    if (agendamento.status === "recusado") {
      return NextResponse.json(
        { error: "Agendamento já foi recusado; não é possível cancelar novamente por este fluxo." },
        { status: 400 }
      );
    }

    const cancelledAt = new Date();
    const updatePayload = {
      status: "cancelado" as const,
      cancelReason: cancellationComment,
      cancelledAt,
    };

    try {
      const rows = await prisma.appointment.updateMany({
        where: {
          id: idNum,
          status: { notIn: ["cancelado", "recusado"] },
        },
        data: updatePayload,
      });
      if (rows.count === 0) {
        const cur = await prisma.appointment.findUnique({ where: { id: idNum } });
        if (cur?.status === "cancelado") {
          return NextResponse.json({
            message: "Este agendamento já estava cancelado.",
            alreadyProcessed: true,
            agendamento: { id: cur.id, status: "cancelado" },
          });
        }
        return NextResponse.json(
          { error: "Não foi possível cancelar no estado atual." },
          { status: 409 }
        );
      }

      await prisma.service.updateMany({
        where: { appointmentId: idNum },
        data: { status: "cancelado" },
      });

      const liberados = await releaseBookingCouponsForAppointment(idNum);
      if (liberados === 0) {
        console.log(`[Admin] Nenhum cupom de uso para liberar no agendamento ${id}`);
      }

      await reconcileAppointmentWithServices(idNum);
    } catch (updateErr: any) {
      // Se falhar por coluna inexistente (banco desatualizado), tentar só status
      const msg = String(updateErr?.message || "").toLowerCase();
      if (msg.includes("invalid") || msg.includes("unknown column") || msg.includes("does not exist")) {
        try {
          const fb = await prisma.appointment.updateMany({
            where: { id: idNum, status: { notIn: ["cancelado", "recusado"] } },
            data: { status: "cancelado" },
          });
          if (fb.count === 0) {
            const cur = await prisma.appointment.findUnique({ where: { id: idNum } });
            if (cur?.status === "cancelado") {
              return NextResponse.json({
                message: "Este agendamento já estava cancelado.",
                alreadyProcessed: true,
                agendamento: { id: cur.id, status: "cancelado" },
              });
            }
          }
          await prisma.service.updateMany({
            where: { appointmentId: idNum },
            data: { status: "cancelado" },
          });
          await releaseBookingCouponsForAppointment(idNum);
          await reconcileAppointmentWithServices(idNum);
          console.warn("[Admin] Cancelamento salvo só com status (colunas cancelReason/cancelledAt podem não existir no banco). Rode: npx prisma db push");
        } catch (fallbackErr: any) {
          console.error("[Admin] Erro no update (fallback):", fallbackErr);
          return NextResponse.json(
            { error: "Erro ao salvar cancelamento. Atualize o banco: no terminal rode 'npx prisma db push' e reinicie o servidor." },
            { status: 500 }
          );
        }
      } else {
        console.error("[Admin] Erro no update:", updateErr);
        return NextResponse.json(
          { error: "Erro ao salvar cancelamento. Tente novamente." },
          { status: 500 }
        );
      }
    }

    console.log(`[Admin] Agendamento ${id} cancelado. Justificativa salva. Usuário pode escolher reembolso ou cupom na Minha Conta.`);

    // Email informando cancelamento e que o usuário deve escolher reembolso ou cupom na Minha Conta
    try {
      await sendAppointmentCancelledEmail(
        agendamento.user.email,
        agendamento.user.nomeArtistico,
        agendamento.data,
        cancellationComment,
        undefined // sem cupom aqui; usuário escolhe na conta
      );
      console.log(`[Admin] Email de cancelamento enviado para ${agendamento.user.email}`);
    } catch (emailError: any) {
      console.error("[Admin] Erro ao enviar email (não crítico):", emailError);
    }

    return NextResponse.json({ 
      message: "Agendamento cancelado com sucesso",
      agendamento: {
        id: agendamento.id,
        status: "cancelado",
      },
    });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    console.error("[Admin] Erro ao cancelar agendamento:", err);
    const mensagem = err?.message && !String(err.message).includes("Invalid `prisma") 
      ? err.message 
      : "Erro ao cancelar agendamento. Se persistir, rode no terminal: npx prisma db push";
    return NextResponse.json({ error: mensagem }, { status: 500 });
  }
}
