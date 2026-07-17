import { NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth";
import { canUseSymbolicSimulation } from "@/app/lib/symbolic-payment";
import { runHomologationSimulation } from "@/app/lib/homologation/engine";
import { goLiveBlockIfNeeded } from "@/app/lib/go-live-maintenance";

/**
 * POST /api/admin/homologation/run
 * Simulação gratuita (SimulationProvider) — sem Asaas.
 */
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    if (!canUseSymbolicSimulation(user) || user.role !== "ADMIN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }
    const blocked = goLiveBlockIfNeeded(user.role);
    if (blocked) return blocked;

    const body = await req.json().catch(() => ({}));
    const run = await runHomologationSimulation({
      userId: user.id,
      userEmail: user.email,
      userName: user.nomeArtistico || user.email,
      tipo: body.tipo === "plano" ? "plano" : "agendamento",
      servicos: body.servicos,
      beats: body.beats,
      data: body.data,
      hora: body.hora,
      duracaoMinutos: body.duracaoMinutos,
      observacoes: body.observacoes,
      planId: body.planId,
      modo: body.modo === "anual" ? "anual" : "mensal",
      runRefund: Boolean(body.runRefund),
    });

    return NextResponse.json({ run });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "Não autenticado" || msg === "Acesso negado") {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    console.error("[homologation/run]", err);
    return NextResponse.json({ error: msg || "Erro na homologação." }, { status: 500 });
  }
}
