/**
 * TE-01B — Scenario Runner.
 */
import { buildExecutionReport, printExecutionReport } from "@/app/lib/test-engine/execution-report";
import { assertTestEngineAllowed, type TeActor } from "@/app/lib/test-engine/permissions";
import { getScenario, listScenarioIds, listScenarios } from "@/app/lib/test-engine/scenario-registry";
import type {
  ExecutionReport,
  ScenarioContext,
  ScenarioId,
  ScenarioResult,
} from "@/app/lib/test-engine/types";

function newRunId(): string {
  return `te_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export type RunOptions = {
  actor?: TeActor;
  cliToken?: string | null;
  artifactPrefix?: string;
  print?: boolean;
};

async function executeOne(
  id: ScenarioId,
  ctxBase: ScenarioContext
): Promise<ScenarioResult> {
  const def = getScenario(id);
  const started = Date.now();
  if (!def) {
    return {
      id,
      name: id,
      status: "error",
      durationMs: Date.now() - started,
      asserts: [],
      errors: [`Cenário ${id} não encontrado no registry`],
      warnings: [],
    };
  }

  try {
    const body = await def.run(ctxBase);
    return {
      id: def.id,
      name: def.name,
      status: body.status,
      durationMs: Date.now() - started,
      asserts: body.asserts,
      errors: body.errors,
      warnings: body.warnings,
      artifacts: body.artifacts,
    };
  } catch (e: unknown) {
    return {
      id: def.id,
      name: def.name,
      status: "error",
      durationMs: Date.now() - started,
      asserts: [],
      errors: [e instanceof Error ? e.message : String(e)],
      warnings: [],
    };
  }
}

export async function runScenario(
  id: ScenarioId,
  opts: RunOptions = {}
): Promise<ExecutionReport> {
  const startedAt = new Date().toISOString();
  const runId = newRunId();
  const gate = assertTestEngineAllowed({
    actor: opts.actor,
    cliToken: opts.cliToken,
  });

  if (!gate.allowed) {
    const report = buildExecutionReport({
      runId,
      startedAt,
      gate,
      results: [
        {
          id,
          name: id,
          status: "skipped",
          durationMs: 0,
          asserts: [],
          errors: [],
          warnings: [gate.reason || "bloqueado"],
        },
      ],
    });
    if (opts.print !== false) printExecutionReport(report);
    return report;
  }

  const ctx: ScenarioContext = {
    runId,
    startedAt,
    actor: opts.actor,
    cliToken: opts.cliToken,
    artifactPrefix: opts.artifactPrefix || "te01b",
  };

  const result = await executeOne(id, ctx);
  const report = buildExecutionReport({
    runId,
    startedAt,
    gate,
    results: [result],
  });
  if (opts.print !== false) printExecutionReport(report);
  return report;
}

export async function runAllScenarios(opts: RunOptions = {}): Promise<ExecutionReport> {
  const startedAt = new Date().toISOString();
  const runId = newRunId();
  const gate = assertTestEngineAllowed({
    actor: opts.actor,
    cliToken: opts.cliToken,
  });

  if (!gate.allowed) {
    const report = buildExecutionReport({
      runId,
      startedAt,
      gate,
      results: listScenarioIds().map((id) => ({
        id,
        name: id,
        status: "skipped" as const,
        durationMs: 0,
        asserts: [],
        errors: [],
        warnings: [gate.reason || "bloqueado"],
      })),
    });
    if (opts.print !== false) printExecutionReport(report);
    return report;
  }

  const ctx: ScenarioContext = {
    runId,
    startedAt,
    actor: opts.actor,
    cliToken: opts.cliToken,
    artifactPrefix: opts.artifactPrefix || "te01b",
  };

  const results: ScenarioResult[] = [];
  for (const id of listScenarioIds()) {
    results.push(await executeOne(id, ctx));
  }

  const report = buildExecutionReport({ runId, startedAt, gate, results });
  if (opts.print !== false) printExecutionReport(report);
  return report;
}

export async function runScenarioIds(
  ids: ScenarioId[],
  opts: RunOptions & { reportId?: ExecutionReport["reportId"] } = {}
): Promise<ExecutionReport> {
  const startedAt = new Date().toISOString();
  const runId = newRunId();
  const gate = assertTestEngineAllowed({
    actor: opts.actor,
    cliToken: opts.cliToken,
  });

  if (!gate.allowed) {
    const report = buildExecutionReport({
      runId,
      startedAt,
      gate,
      reportId: opts.reportId,
      results: ids.map((id) => ({
        id,
        name: id,
        status: "skipped" as const,
        durationMs: 0,
        asserts: [],
        errors: [],
        warnings: [gate.reason || "bloqueado"],
      })),
    });
    if (opts.print !== false) printExecutionReport(report);
    return report;
  }

  const ctx: ScenarioContext = {
    runId,
    startedAt,
    actor: opts.actor,
    cliToken: opts.cliToken,
    artifactPrefix: opts.artifactPrefix || "te02a",
  };

  const results: ScenarioResult[] = [];
  for (const id of ids) {
    results.push(await executeOne(id, ctx));
  }

  const report = buildExecutionReport({
    runId,
    startedAt,
    gate,
    results,
    reportId: opts.reportId,
  });
  if (opts.print !== false) printExecutionReport(report);
  return report;
}

export function describeRegistry(): {
  id: ScenarioId;
  name: string;
  status: string;
  description: string;
}[] {
  return listScenarios().map((s) => ({
    id: s.id,
    name: s.name,
    status: s.status,
    description: s.description,
  }));
}
