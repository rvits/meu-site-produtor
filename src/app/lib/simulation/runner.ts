/**
 * SIM-01 — Simulation Runner.
 */

import { buildSimulationReport, printSimulationReport } from "@/app/lib/simulation/report";
import { assertSimulationAllowed, type SimActor } from "@/app/lib/simulation/permissions";
import { getSimulation, listSimulationIds } from "@/app/lib/simulation/registry";
import { buildSession, newSessionId } from "@/app/lib/simulation/session";
import type {
  SimulationContext,
  SimulationId,
  SimulationReport,
  SimulationSession,
  SimulationStatus,
} from "@/app/lib/simulation/types";

function newRunId(): string {
  return `simrun_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export type RunSimulationOptions = {
  actor?: SimActor;
  cliToken?: string | null;
  artifactPrefix?: string;
  print?: boolean;
};

async function executeOne(
  id: SimulationId,
  ctx: SimulationContext
): Promise<SimulationSession> {
  const def = getSimulation(id);
  const sessionId = newSessionId();
  const started = Date.now();

  if (!def) {
    return buildSession({
      def: { id, name: id, description: "", pipeline: [], run: async () => ({ status: "error", asserts: [], errors: [], warnings: [], userId: "", email: "" }) },
      ctx,
      sessionId,
      durationMs: 0,
      status: "error",
      userId: "",
      email: "",
      asserts: [],
      errors: [`Simulação ${id} não encontrada`],
      warnings: [],
      eventsProduced: [],
      cleanup: {},
    });
  }

  try {
    const body = await def.run(ctx);
    const status: SimulationStatus = body.status;
    return buildSession({
      def,
      ctx,
      sessionId,
      durationMs: Date.now() - started,
      status,
      userId: body.userId,
      email: body.email,
      asserts: body.asserts,
      errors: body.errors,
      warnings: body.warnings,
      eventsProduced: body.eventsProduced || [],
      cleanup: body.cleanup || {},
      artifacts: body.artifacts,
    });
  } catch (e: unknown) {
    return buildSession({
      def,
      ctx,
      sessionId,
      durationMs: Date.now() - started,
      status: "error",
      userId: "",
      email: "",
      asserts: [],
      errors: [e instanceof Error ? e.message : String(e)],
      warnings: [],
      eventsProduced: [],
      cleanup: {},
    });
  }
}

export async function runSimulation(
  id: SimulationId,
  opts: RunSimulationOptions = {}
): Promise<SimulationReport> {
  const startedAt = new Date().toISOString();
  const runId = newRunId();
  const gate = assertSimulationAllowed({ actor: opts.actor, cliToken: opts.cliToken });

  if (!gate.allowed) {
    const report = buildSimulationReport({
      runId,
      startedAt,
      gate,
      sessions: [
        buildSession({
          def: getSimulation(id) || {
            id,
            name: id,
            description: "",
            pipeline: [],
            run: async () => ({ status: "skipped", asserts: [], errors: [], warnings: [], userId: "", email: "" }),
          },
          ctx: { simulationId: id, runId, startedAt, artifactPrefix: "sim01" },
          sessionId: newSessionId(),
          durationMs: 0,
          status: "skipped",
          userId: "",
          email: "",
          asserts: [],
          errors: [],
          warnings: [gate.reason || "bloqueado"],
          eventsProduced: [],
          cleanup: {},
        }),
      ],
    });
    if (opts.print !== false) printSimulationReport(report);
    return report;
  }

  const ctx: SimulationContext = {
    simulationId: id,
    runId,
    startedAt,
    actor: opts.actor,
    cliToken: opts.cliToken,
    artifactPrefix: opts.artifactPrefix || "sim01",
  };

  const session = await executeOne(id, ctx);
  const report = buildSimulationReport({ runId, startedAt, gate, sessions: [session] });
  if (opts.print !== false) printSimulationReport(report);
  return report;
}

export async function runSimulationBatch(
  ids: SimulationId[],
  opts: RunSimulationOptions = {}
): Promise<SimulationReport> {
  const startedAt = new Date().toISOString();
  const runId = newRunId();
  const gate = assertSimulationAllowed({ actor: opts.actor, cliToken: opts.cliToken });
  const progress: SimulationReport["progress"] = [];

  if (!gate.allowed) {
    const report = buildSimulationReport({
      runId,
      startedAt,
      gate,
      sessions: ids.map((id) =>
        buildSession({
          def: getSimulation(id) || { id, name: id, description: "", pipeline: [], run: async () => ({ status: "skipped", asserts: [], errors: [], warnings: [], userId: "", email: "" }) },
          ctx: { simulationId: id, runId, startedAt, artifactPrefix: "sim01" },
          sessionId: newSessionId(),
          durationMs: 0,
          status: "skipped",
          userId: "",
          email: "",
          asserts: [],
          errors: [],
          warnings: [gate.reason || "bloqueado"],
          eventsProduced: [],
          cleanup: {},
        })
      ),
    });
    if (opts.print !== false) printSimulationReport(report);
    return report;
  }

  const ctxBase: SimulationContext = {
    simulationId: "SIM-001",
    runId,
    startedAt,
    actor: opts.actor,
    cliToken: opts.cliToken,
    artifactPrefix: opts.artifactPrefix || "sim01",
  };

  const sessions: SimulationSession[] = [];
  for (const id of ids) {
    progress.push({ step: "running", simulationId: id, at: new Date().toISOString() });
    const ctx = { ...ctxBase, simulationId: id };
    sessions.push(await executeOne(id, ctx));
    progress.push({ step: "completed", simulationId: id, at: new Date().toISOString() });
  }

  const report = buildSimulationReport({ runId, startedAt, gate, sessions, progress });
  if (opts.print !== false) printSimulationReport(report);
  return report;
}

export async function runAllSimulations(opts: RunSimulationOptions = {}): Promise<SimulationReport> {
  return runSimulationBatch(listSimulationIds(), opts);
}
