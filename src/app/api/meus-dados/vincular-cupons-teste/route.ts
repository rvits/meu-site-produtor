/**
 * POST /api/meus-dados/vincular-cupons-teste
 * Vincula cupons de teste (TESTE_AGEND_*) à conta do usuário: atualiza o agendamento
 * para userId do usuário e o pagamento para appointmentId, para os cupons aparecerem em Minha Conta.
 */
import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export async function POST() {
  try {
    const user = await requireAuth();

    const pagamento = await prisma.payment.findFirst({
      where: {
        userId: user.id,
        amount: 5,
        type: "agendamento",
        status: "approved",
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, appointmentId: true },
    });

    if (!pagamento) {
      return NextResponse.json(
        { success: false, error: "Nenhum pagamento de teste (R$ 5, agendamento) encontrado na sua conta." },
        { status: 404 }
      );
    }

    const cuponsTeste = await prisma.coupon.findMany({
      where: { code: { startsWith: "TESTE_AGEND_" }, appointmentId: { not: null } },
      select: { appointmentId: true },
    });
    const appointmentIds = [...new Set(cuponsTeste.map((c) => c.appointmentId).filter((id): id is number => id != null))];

    let agendamentoId: number | null = pagamento.appointmentId;
    if (!agendamentoId && appointmentIds.length === 1) {
      agendamentoId = appointmentIds[0];
    } else if (!agendamentoId && appointmentIds.length > 1) {
      const comPagamento = appointmentIds.find((aid) => {
        const p = cuponsTeste.find((c) => c.appointmentId === aid);
        return p;
      });
      agendamentoId = comPagamento ?? appointmentIds[0];
    }

    if (!agendamentoId) {
      return NextResponse.json(
        { success: false, error: "Nenhum agendamento de teste encontrado para vincular." },
        { status: 404 }
      );
    }

    await prisma.appointment.update({
      where: { id: agendamentoId },
      data: { userId: user.id },
    });

    try {
      await prisma.payment.update({
        where: { id: pagamento.id },
        data: { appointmentId: agendamentoId },
      });
    } catch (e) {
      console.warn("[vincular-cupons-teste] Payment.update falhou:", e);
    }

    const cuponsCount = await prisma.coupon.count({
      where: { appointmentId: agendamentoId },
    });

    return NextResponse.json({
      success: true,
      message: cuponsCount > 0
        ? `${cuponsCount} cupom(ns) vinculado(s) à sua conta. Eles devem aparecer abaixo.`
        : "Agendamento vinculado. Se os cupons não aparecerem, atualize a página (F5).",
      appointmentId: agendamentoId,
      cuponsCount,
    });
  } catch (err: any) {
    if (err.message === "Não autenticado") {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }
    console.error("[vincular-cupons-teste]", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Erro ao vincular cupons." },
      { status: 500 }
    );
  }
}
