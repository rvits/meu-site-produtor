import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { sendAppointmentCancelledEmail } from "@/app/lib/sendEmail";
import { generateCouponCode } from "@/app/lib/coupons";
import { refundAsaasPayment } from "@/app/lib/asaas-refund";
import { releaseBookingCouponsForAppointment } from "@/app/lib/coupon-release";
import { reconcileAppointmentWithServices } from "@/app/lib/appointment-service-sync";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { appointmentId, refundType } = body; // refundType: "direct" ou "coupon"

    if (!appointmentId) {
      return NextResponse.json({ error: "ID do agendamento é obrigatório" }, { status: 400 });
    }

    // Buscar agendamento
    const agendamento = await prisma.appointment.findUnique({
      where: { id: parseInt(appointmentId) },
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

    if (agendamento.status === "cancelado") {
      return NextResponse.json({
        message: "Este agendamento já estava cancelado.",
        alreadyProcessed: true,
        agendamento: { id: agendamento.id, status: "cancelado" },
      });
    }

    // Verificar se o agendamento pertence ao usuário
    if (agendamento.userId !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Agendamento aceito, confirmado ou já em andamento (cliente pode solicitar cancelamento conforme política)
    if (
      agendamento.status !== "aceito" &&
      agendamento.status !== "confirmado" &&
      agendamento.status !== "em_andamento"
    ) {
      return NextResponse.json(
        { error: "Apenas agendamentos aceitos ou em andamento podem ser cancelados por aqui" },
        { status: 400 }
      );
    }

    // Buscar pagamento associado
    const payment = await prisma.payment.findFirst({
      where: { appointmentId: parseInt(appointmentId), status: "approved" },
      orderBy: { createdAt: "desc" },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Pagamento não encontrado para este agendamento" },
        { status: 400 }
      );
    }

    // Verificar se o pagamento foi aprovado
    if (payment.status !== "approved") {
      return NextResponse.json(
        { error: "Apenas agendamentos com pagamento aprovado podem ser cancelados" },
        { status: 400 }
      );
    }

    const liberados = await releaseBookingCouponsForAppointment(parseInt(appointmentId, 10));
    if (liberados > 0) {
      console.log(`[Cancelar Agendamento] ${liberados} cupom(ns) de uso liberado(s)`);
    }

    // Calcular valor de reembolso
    const refundAmount = payment.amount;
    let couponCode: string | null = null;
    let refundDirectSuccess: boolean = false;
    let finalRefundType = refundType; // Usar variável mutável

    // Processar reembolso baseado no tipo escolhido
    if (refundAmount && refundAmount > 0) {
      if (finalRefundType === "direct") {
        // Reembolso direto via Asaas
        try {
          if (payment.asaasId) {
            await refundAsaasPayment(
              payment.asaasId,
              refundAmount,
              `Reembolso de cancelamento de agendamento #${appointmentId}`
            );
            refundDirectSuccess = true;
            console.log(`[Cancelar Agendamento] Reembolso direto realizado: R$ ${refundAmount.toFixed(2)}`);
          } else {
            console.warn("[Cancelar Agendamento] Pagamento não tem asaasId para reembolso direto, criando cupom como fallback");
            finalRefundType = "coupon";
          }
        } catch (refundError: any) {
          console.error("[Cancelar Agendamento] Erro ao fazer reembolso direto:", refundError);
          // Fallback: criar cupom se reembolso direto falhar
          finalRefundType = "coupon";
        }
      }

      // Se escolheu cupom ou se reembolso direto falhou, criar cupom
      if (finalRefundType === "coupon" || (!refundDirectSuccess && finalRefundType === "direct")) {
        try {
          const refundCoupon = await prisma.coupon.create({
            data: {
              code: generateCouponCode(),
              couponType: "reembolso",
              discountType: "fixed",
              discountValue: refundAmount,
              appointmentId: parseInt(appointmentId),
              expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 dias
            },
          });
          couponCode = refundCoupon.code;
          console.log(`[Cancelar Agendamento] Cupom de reembolso criado: ${couponCode} - Valor: R$ ${refundAmount.toFixed(2)}`);
        } catch (couponError: any) {
          console.error("[Cancelar Agendamento] Erro ao criar cupom de reembolso:", couponError);
        }
      }
    }

    const aptIdNum = parseInt(appointmentId, 10);
    const cancelRows = await prisma.appointment.updateMany({
      where: {
        id: aptIdNum,
        userId: user.id,
        status: { in: ["aceito", "confirmado", "em_andamento"] },
      },
      data: { status: "cancelado" },
    });
    if (cancelRows.count === 0) {
      const cur = await prisma.appointment.findUnique({ where: { id: aptIdNum } });
      if (cur?.status === "cancelado") {
        return NextResponse.json({
          message: "Agendamento já cancelado.",
          alreadyProcessed: true,
          agendamento: { id: cur.id, status: "cancelado" },
        });
      }
      return NextResponse.json(
        { error: "Não foi possível cancelar o agendamento no estado atual." },
        { status: 409 }
      );
    }

    await prisma.service.updateMany({
      where: { appointmentId: aptIdNum },
      data: { status: "cancelado" },
    });

    await reconcileAppointmentWithServices(aptIdNum);

    console.log(`[Cancelar Agendamento] Agendamento ${appointmentId} cancelado. Horário liberado.`);

    // Enviar email de cancelamento
    try {
      await sendAppointmentCancelledEmail(
        agendamento.user.email,
        agendamento.user.nomeArtistico || "Cliente",
        agendamento.data,
        "Agendamento cancelado pelo usuário.",
        couponCode || undefined
      );
      console.log(`[Cancelar Agendamento] Email de cancelamento enviado para ${agendamento.user.email}`);
    } catch (emailError: any) {
      console.error("[Cancelar Agendamento] Erro ao enviar email (não crítico):", emailError);
    }

    return NextResponse.json({
      message: "Agendamento cancelado com sucesso",
      refundAmount,
      couponCode,
      refundType: refundDirectSuccess ? "direct" : (couponCode ? "coupon" : null),
      agendamento: {
        id: agendamento.id,
        status: "cancelado",
      },
    });
  } catch (err: any) {
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    console.error("[Cancelar Agendamento] Erro:", err);
    return NextResponse.json({
      error: err.message || "Erro ao cancelar agendamento",
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    }, { status: 500 });
  }
}
