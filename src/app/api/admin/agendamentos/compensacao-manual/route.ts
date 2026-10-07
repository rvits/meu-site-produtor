import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAdmin } from "@/app/lib/auth";
import {
  MANUAL_COMPENSATION_OPTION,
  decideManualCompensation,
  parseManualCompensationReason,
} from "@/app/lib/manual-compensation";

/**
 * Marca um agendamento recusado ou cancelado como compensado manualmente.
 * Não cria cupom, não altera Payment e não chama o Asaas.
 * A gravação é condicional: só vence se cancelRefundOption ainda for nulo.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await req.json().catch(() => null);
    const reason = parseManualCompensationReason(
      body && typeof body === "object" ? (body as { reason?: unknown; motivo?: unknown }).reason ?? (body as { motivo?: unknown }).motivo : undefined
    );
    if (!reason.ok) {
      return NextResponse.json(
        { error: "Motivo inválido. Informe um texto de até 500 caracteres." },
        { status: 400 }
      );
    }

    const rawId =
      body && typeof body === "object"
        ? (body as { appointmentId?: unknown; id?: unknown }).appointmentId ??
          (body as { id?: unknown }).id
        : undefined;
    const id = parseInt(String(rawId), 10);
    if (!Number.isFinite(id)) {
      return NextResponse.json({ error: "ID do agendamento inválido." }, { status: 400 });
    }

    const now = new Date();
    const updated = await prisma.appointment.updateMany({
      where: {
        id,
        status: { in: ["recusado", "cancelado"] },
        cancelRefundOption: null,
      },
      data: {
        cancelRefundOption: MANUAL_COMPENSATION_OPTION,
        manualCompensationAt: now,
        manualCompensationBy: admin.id,
        manualCompensationReason: reason.reason,
      },
    });

    if (updated.count === 1) {
      return NextResponse.json({
        ok: true,
        applied: true,
        cancelRefundOption: MANUAL_COMPENSATION_OPTION,
        manualCompensationAt: now.toISOString(),
        manualCompensationReason: reason.reason,
      });
    }

    const current = await prisma.appointment.findUnique({
      where: { id },
      select: {
        status: true,
        cancelRefundOption: true,
        manualCompensationAt: true,
        manualCompensationReason: true,
      },
    });
    const decision = decideManualCompensation({
      updatedCount: 0,
      appointment: current,
    });

    if (decision.outcome === "already_manual") {
      return NextResponse.json({
        ok: true,
        applied: false,
        alreadyCompensated: true,
        cancelRefundOption: MANUAL_COMPENSATION_OPTION,
        manualCompensationAt: current?.manualCompensationAt?.toISOString() ?? null,
        manualCompensationReason: current?.manualCompensationReason ?? null,
      });
    }
    if (decision.outcome === "not_found") {
      return NextResponse.json({ error: "Agendamento não encontrado." }, { status: 404 });
    }
    if (decision.outcome === "ineligible_status") {
      return NextResponse.json(
        { error: "Somente agendamentos recusados ou cancelados podem ser compensados manualmente." },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error:
          "Esta solicitação já possui uma resolução e não pode ser convertida em compensação manual.",
      },
      { status: 409 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Acesso negado" || message === "Não autenticado") {
      return NextResponse.json({ error: message }, { status: message === "Não autenticado" ? 401 : 403 });
    }
    console.error("[Admin] POST compensacao-manual falhou:", err);
    return NextResponse.json({ error: "Erro ao registrar compensação manual." }, { status: 500 });
  }
}
