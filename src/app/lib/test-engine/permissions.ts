/**
 * TE-01B — permissões do Test Engine.
 * Produção desabilitada. Preview exige flag. Execução CLI/local ou admin.
 * Nenhuma rota pública neste sprint.
 */

export type TeActor = { role: string | null; email: string | null } | null | undefined;

const OWNER_EMAIL = "thouse.rec.tremv@gmail.com";

function isAdminActor(actor: TeActor): boolean {
  if (!actor) return false;
  if (actor.role === "ADMIN") return true;
  if ((actor.email || "").trim().toLowerCase() === OWNER_EMAIL) return true;
  return false;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "").trim();
}

export function isLocalOrDevelopmentRuntime(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const site = siteUrl();
  return /localhost|127\.0\.0\.1/i.test(site);
}

export function isPreviewRuntime(): boolean {
  return process.env.VERCEL_ENV === "preview";
}

export function isProductionRuntimeBlocked(): boolean {
  if (isLocalOrDevelopmentRuntime()) return false;
  if (isPreviewRuntime()) return false;
  return process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
}

export type TeGateResult = {
  allowed: boolean;
  reason?: string;
  warnings: string[];
};

/**
 * Gate único do Test Engine (CLI / futuros callers admin).
 * - Production: sempre bloqueado (TE-01B)
 * - Preview: TEST_ENGINE_ENABLED=1 + (admin OU cli secret)
 * - Local/dev: admin OU cli secret OU (sem secret local → warning)
 */
export function assertTestEngineAllowed(opts: {
  actor?: TeActor;
  cliToken?: string | null;
}): TeGateResult {
  const warnings: string[] = [];

  if (isProductionRuntimeBlocked()) {
    return {
      allowed: false,
      reason: "Test Engine desabilitado em Production (TE-01B).",
      warnings,
    };
  }

  if (isPreviewRuntime() && process.env.TEST_ENGINE_ENABLED !== "1") {
    return {
      allowed: false,
      reason: "Preview exige TEST_ENGINE_ENABLED=1.",
      warnings,
    };
  }

  if (isAdminActor(opts.actor)) {
    return { allowed: true, warnings };
  }

  const expectedSecret = process.env.TEST_ENGINE_CLI_SECRET || "";
  const provided = (opts.cliToken || "").trim();

  if (expectedSecret && provided && provided === expectedSecret) {
    return { allowed: true, warnings };
  }

  if (isLocalOrDevelopmentRuntime()) {
    if (!expectedSecret) {
      warnings.push(
        "TEST_ENGINE_CLI_SECRET ausente — CLI local permitido com warning (somente development/localhost)."
      );
      return { allowed: true, warnings };
    }
    if (!provided) {
      return {
        allowed: false,
        reason: "Informe --token (TEST_ENGINE_CLI_SECRET) ou execute como ADMIN.",
        warnings,
      };
    }
    return {
      allowed: false,
      reason: "Token CLI inválido.",
      warnings,
    };
  }

  return {
    allowed: false,
    reason: "Execução requer ADMIN ou TEST_ENGINE_CLI_SECRET válido.",
    warnings,
  };
}
