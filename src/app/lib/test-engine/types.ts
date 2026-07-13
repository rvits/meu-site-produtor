/**
 * TE-01B — tipos do núcleo do Test Engine.
 * Nenhum fluxo paralelo de domínio.
 */

export type ScenarioId =
  | "TE-S01"
  | "TE-S02"
  | "TE-S03"
  | "TE-S04"
  | "TE-S05"
  | "TE-S06"
  | "TE-S07"
  | "TE-S08"
  | "TE-S09"
  | "TE-S10"
  | "TE-S11"
  | "TE-S12"
  | "TE-S13";

export type ScenarioStatus = "implemented" | "stub" | "skipped" | "pass" | "fail" | "error";

export type AssertResult = {
  name: string;
  ok: boolean;
  message?: string;
  evidence?: Record<string, unknown>;
};

export type ScenarioContext = {
  runId: string;
  startedAt: string;
  actor?: { role: string | null; email: string | null } | null;
  cliToken?: string | null;
  /** Prefixo para emails/artefacts de teste */
  artifactPrefix: string;
};

export type ScenarioResult = {
  id: ScenarioId;
  name: string;
  status: ScenarioStatus;
  durationMs: number;
  asserts: AssertResult[];
  errors: string[];
  warnings: string[];
  artifacts?: Record<string, unknown>;
};

export type ScenarioDefinition = {
  id: ScenarioId;
  name: string;
  description: string;
  status: "implemented" | "stub";
  run: (ctx: ScenarioContext) => Promise<Omit<ScenarioResult, "id" | "name" | "durationMs"> & {
    status: ScenarioStatus;
    asserts: AssertResult[];
    errors: string[];
    warnings: string[];
    artifacts?: Record<string, unknown>;
  }>;
};

export type ExecutionReport = {
  reportId: "TE-01B-execution";
  runId: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  environment: {
    nodeEnv: string | undefined;
    siteUrl: string;
    vercelEnv: string | undefined;
    testEngineEnabled: boolean;
  };
  gate: { allowed: boolean; reason?: string; warnings: string[] };
  results: ScenarioResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    stubs: number;
    skipped: number;
    errors: number;
  };
};
