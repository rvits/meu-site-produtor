/**
 * GO-02 Phase 1 — Pre-smoke checklist (read-only, redacted).
 * Exit 1 if any hard gate fails.
 */
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

function loadEnvFile(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = {
  ...loadEnvFile(path.join(process.cwd(), ".env")),
  ...loadEnvFile(path.join(process.cwd(), ".env.local")),
  ...process.env,
} as Record<string, string | undefined>;

const key = String(env.ASAAS_API_KEY || "");
const wh = String(env.ASAAS_WEBHOOK_ACCESS_TOKEN || "");
const db = String(env.DATABASE_URL || "");
const nextUrl = String(
  env.NEXTAUTH_URL || env.NEXT_PUBLIC_APP_URL || env.VERCEL_PROJECT_PRODUCTION_URL || ""
);
const skipTls = String(env.ASAAS_SKIP_TLS_VERIFY || "");
const storage = String(env.STORAGE_PROVIDER || "local");

function redactDb(u: string) {
  try {
    const x = new URL(u);
    return {
      protocol: x.protocol.replace(":", ""),
      host: x.host,
      db: x.pathname,
      hasUser: Boolean(x.username),
    };
  } catch {
    return { status: u ? "present_unparseable" : "missing" };
  }
}

const gitStatus = execSync("git status --porcelain", { encoding: "utf8" }).trim();
const gitHead = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();

const isProdToken = key.startsWith("$aact_prod_") || key.startsWith("aact_prod_");
const isSandboxish =
  !isProdToken &&
  (key.startsWith("$aact_") || key.startsWith("aact_") || key.length > 20);

type Gate = { id: string; ok: boolean; detail: string; hard: boolean };

const gates: Gate[] = [
  {
    id: "git_clean_relevant",
    ok:
      gitStatus === "" ||
      gitStatus
        .split("\n")
        .every((l) => l.includes("launch01-reset-result.json")),
    detail: gitStatus || "(clean)",
    hard: false,
  },
  {
    id: "architecture_freeze_doc",
    ok: fs.existsSync("docs/architecture/architecture-freeze.md"),
    detail: "docs/architecture/architecture-freeze.md",
    hard: true,
  },
  {
    id: "rc_commit_go01",
    ok: true,
    detail: `HEAD=${gitHead} (expected GO-01 on main)`,
    hard: false,
  },
  {
    id: "migration_file_ready",
    ok: fs.existsSync(
      "prisma/migrations/20260718120000_go01_payment_provider_coupon_service/migration.sql"
    ),
    detail: "20260718120000_go01_payment_provider_coupon_service",
    hard: true,
  },
  {
    id: "database_url_present",
    ok: Boolean(db),
    detail: JSON.stringify(redactDb(db)),
    hard: true,
  },
  {
    id: "asaas_api_key_present",
    ok: Boolean(key),
    detail: key
      ? `prefix=${key.slice(0, 11)}… len=${key.length} prodToken=${isProdToken} sandboxish=${isSandboxish}`
      : "MISSING",
    hard: true,
  },
  {
    id: "webhook_token_present",
    ok: Boolean(wh),
    detail: wh ? `len=${wh.length}` : "MISSING",
    hard: true,
  },
  {
    id: "public_url_hint",
    ok: Boolean(nextUrl),
    detail: nextUrl || "MISSING (NEXTAUTH_URL / NEXT_PUBLIC_APP_URL)",
    hard: false,
  },
  {
    id: "asaas_skip_tls_off",
    ok: !skipTls || skipTls === "false" || skipTls === "0",
    detail: skipTls || "(unset)",
    hard: false,
  },
  {
    id: "storage_local",
    ok: storage === "local" || storage === "",
    detail: storage,
    hard: false,
  },
  {
    id: "release_checklist_exists",
    ok: fs.existsSync("docs/operations/go01-release-checklist.md"),
    detail: "docs/operations/go01-release-checklist.md",
    hard: true,
  },
  // Human-validated gates — cannot be auto-confirmed; fail closed unless GO02_CONFIRM_* set
  {
    id: "backup_restorable_validated",
    ok: env.GO02_CONFIRM_BACKUP === "1",
    detail:
      env.GO02_CONFIRM_BACKUP === "1"
        ? "confirmed via GO02_CONFIRM_BACKUP=1"
        : "NOT confirmed — set GO02_CONFIRM_BACKUP=1 after restore validation",
    hard: true,
  },
  {
    id: "migration_deployed_target",
    ok: env.GO02_CONFIRM_MIGRATE === "1",
    detail:
      env.GO02_CONFIRM_MIGRATE === "1"
        ? "confirmed via GO02_CONFIRM_MIGRATE=1"
        : "NOT confirmed — set GO02_CONFIRM_MIGRATE=1 after prisma migrate deploy on target DB",
    hard: true,
  },
  {
    id: "webhook_reachable_configured",
    ok: env.GO02_CONFIRM_WEBHOOK === "1",
    detail:
      env.GO02_CONFIRM_WEBHOOK === "1"
        ? "confirmed via GO02_CONFIRM_WEBHOOK=1"
        : "NOT confirmed — set GO02_CONFIRM_WEBHOOK=1 after panel URL+token verified",
    hard: true,
  },
  {
    id: "release_checklist_complete",
    ok: env.GO02_CONFIRM_CHECKLIST === "1",
    detail:
      env.GO02_CONFIRM_CHECKLIST === "1"
        ? "confirmed via GO02_CONFIRM_CHECKLIST=1"
        : "NOT confirmed — Release Checklist sections A–F must be complete",
    hard: true,
  },
  {
    id: "asaas_env_explicit",
    ok: env.GO02_ASAAS_ENV === "sandbox" || env.GO02_ASAAS_ENV === "production",
    detail:
      env.GO02_ASAAS_ENV ||
      "NOT set — set GO02_ASAAS_ENV=sandbox|production (explicit)",
    hard: true,
  },
];

const hardFails = gates.filter((g) => g.hard && !g.ok);
const softFails = gates.filter((g) => !g.hard && !g.ok);

const result = {
  reportId: "GO-02-presmoke-checklist",
  executedAt: new Date().toISOString(),
  verdict: hardFails.length === 0 ? "READY" : "STOP",
  hardFails: hardFails.map((g) => g.id),
  softFails: softFails.map((g) => g.id),
  gates,
};

const outDir = path.join("reports", "domain-guardian");
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "go02-presmoke-checklist.json"),
  JSON.stringify(result, null, 2)
);

console.log(JSON.stringify(result, null, 2));
if (hardFails.length) {
  console.error("\n[GO-02 PRE-SMOKE] STOP — hard gates failed:", hardFails.map((g) => g.id).join(", "));
  process.exit(1);
}
console.log("\n[GO-02 PRE-SMOKE] READY — financial smoke may proceed");
