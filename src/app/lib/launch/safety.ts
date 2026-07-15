export type ResetTarget = "local" | "preview" | "production";

export function detectResetTarget(dbUrl: string, env: NodeJS.ProcessEnv = process.env): ResetTarget {
  if (/localhost|127\.0\.0\.1/.test(dbUrl)) return "local";
  if (env.LAUNCH01_TARGET === "preview" || env.VERCEL_ENV === "preview") return "preview";
  if (env.LAUNCH01_TARGET === "production" || env.VERCEL_ENV === "production") return "production";
  return "production";
}

export type ResetConfirmationResult = { ok: true } | { ok: false; error: string; required: string[] };

/**
 * Confirmações explícitas — nunca executar reset sem flags corretas (GO-01 Fase 4).
 */
export function validateResetConfirmation(
  target: ResetTarget,
  argv: string[],
  env: NodeJS.ProcessEnv = process.env
): ResetConfirmationResult {
  const execute = argv.includes("--execute");
  if (!execute) return { ok: true };

  if (target === "local") {
    if (!argv.includes("--confirm-local")) {
      return {
        ok: false,
        error: "Reset LOCAL bloqueado: use --execute --confirm-local",
        required: ["--execute", "--confirm-local"],
      };
    }
    return { ok: true };
  }

  if (target === "preview") {
    const required = ["--execute", "--confirm-preview", "LAUNCH01_TARGET=preview", "LAUNCH01_CONFIRM_PREVIEW=1"];
    if (env.LAUNCH01_TARGET !== "preview") {
      return { ok: false, error: "Reset PREVIEW bloqueado: defina LAUNCH01_TARGET=preview", required };
    }
    if (env.LAUNCH01_CONFIRM_PREVIEW !== "1") {
      return { ok: false, error: "Reset PREVIEW bloqueado: defina LAUNCH01_CONFIRM_PREVIEW=1", required };
    }
    if (!argv.includes("--confirm-preview")) {
      return { ok: false, error: "Reset PREVIEW bloqueado: use --confirm-preview", required };
    }
    return { ok: true };
  }

  const required = [
    "--execute",
    "--confirm-production",
    "LAUNCH01_CONFIRM_PRODUCTION=1",
    'LAUNCH01_CONFIRM_PHRASE="RESET THOUSE PRODUCTION"',
  ];
  if (env.LAUNCH01_CONFIRM_PRODUCTION !== "1") {
    return { ok: false, error: "Reset PRODUCTION bloqueado: LAUNCH01_CONFIRM_PRODUCTION=1", required };
  }
  if (!argv.includes("--confirm-production")) {
    return { ok: false, error: "Reset PRODUCTION bloqueado: --confirm-production", required };
  }
  if (env.LAUNCH01_CONFIRM_PHRASE !== "RESET THOUSE PRODUCTION") {
    return {
      ok: false,
      error: 'Reset PRODUCTION bloqueado: LAUNCH01_CONFIRM_PHRASE="RESET THOUSE PRODUCTION"',
      required,
    };
  }
  return { ok: true };
}
