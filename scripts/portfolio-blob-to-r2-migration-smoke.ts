/**
 * Smoke da rota temporária Blob → R2. Sem rede, sem Production, sem PUT real.
 */
import fs from "node:fs";
import path from "node:path";
import { planPortfolioR2ObjectKey, sha256Hex } from "../src/app/lib/storage/portfolio-blob-to-r2";
import {
  BLOB_TO_R2_MIGRATION_MANIFEST,
  MIGRATION_EXPECTED_BYTES,
  MIGRATION_MAX_BODY_BYTES,
  MigrationCreateConflict,
  inspectMigrationManifest,
  readMigrationBody,
  runTemporaryBlobToR2Migration,
  type DestinationHead,
  type MigrationDeps,
  type MigrationManifestItem,
} from "../src/app/api/admin/portfolio/blob-to-r2-migration/execute";

function manifestItem(id: string): MigrationManifestItem {
  const item = BLOB_TO_R2_MIGRATION_MANIFEST.find((entry) => entry.id === id);
  if (!item) throw new Error(`manifest item ${id} ausente`);
  return item;
}

const ITEM = manifestItem("04");

type Calls = {
  admin: number;
  sourceHead: number;
  sourceGet: number;
  targetHead: number;
  targetGet: number;
  put: number;
  stored: number;
};

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function copyRequest(id = "04", extra: Record<string, unknown> = {}) {
  return { operation: "copy", confirm: "YES", id, ...extra };
}

function harness(options: {
  env?: string;
  admin?: "ok" | "anonymous" | "forbidden";
  sourceSize?: number;
  sourceType?: string;
  sourceBytes?: Buffer | "short";
  destination?: DestinationHead;
  destinationBytes?: Buffer;
  verifiedHead?: DestinationHead;
  verifiedBytes?: Buffer;
  planKey?: MigrationDeps["planKey"];
  putThrows?: boolean;
  putConflict?: { head: DestinationHead; bytes?: Buffer };
}) {
  const calls: Calls = { admin: 0, sourceHead: 0, sourceGet: 0, targetHead: 0, targetGet: 0, put: 0, stored: 0 };
  const sourceBytes = options.sourceBytes === "short" ? Buffer.from("short") : options.sourceBytes ?? Buffer.alloc(ITEM.size, 7);
  const deps: MigrationDeps = {
    vercelEnv: options.env ?? "production",
    planKey: options.planKey,
    async requireAdmin() {
      calls.admin += 1;
      if (options.admin === "anonymous") throw new Error("Não autenticado");
      if (options.admin === "forbidden") throw new Error("Acesso negado");
    },
    async headSource() {
      calls.sourceHead += 1;
      return { size: options.sourceSize ?? ITEM.size, contentType: options.sourceType ?? ITEM.contentType };
    },
    async getSourceBytes() {
      calls.sourceGet += 1;
      return sourceBytes;
    },
    async headTarget() {
      calls.targetHead += 1;
      if (calls.put > 0 && options.putConflict) return options.putConflict.head;
      if (calls.put > 0) {
        return options.verifiedHead ?? { exists: true, size: ITEM.size, contentType: ITEM.contentType };
      }
      return options.destination ?? { exists: false };
    },
    async getTargetBytes() {
      calls.targetGet += 1;
      if (calls.put > 0 && options.putConflict?.bytes) return options.putConflict.bytes;
      if (calls.put > 0) return options.verifiedBytes ?? sourceBytes;
      return options.destinationBytes ?? sourceBytes;
    },
    async putTarget(input) {
      calls.put += 1;
      must(input.objectKey === ITEM.plannedKey, "put em key diferente do manifest");
      must(input.contentType === ITEM.contentType, "put com contentType diferente do manifest");
      must(input.bytes.equals(sourceBytes), "put com bytes diferentes da origem");
      if (options.putConflict) throw new MigrationCreateConflict();
      calls.stored += 1;
      if (options.putThrows) throw new Error("put failed");
    },
  };
  return { calls, deps, sourceBytes };
}

async function runCase(body: unknown, options: Parameters<typeof harness>[0] = {}) {
  const state = harness(options);
  const result = await runTemporaryBlobToR2Migration(body, state.deps);
  return { ...state, result };
}

async function main() {
  const summary = inspectMigrationManifest();
  must(summary.items === 14, "18 items");
  must(summary.uniqueIds === 14, "18 unique ids");
  must(summary.uniquePathnames === 14, "19 unique pathnames");
  must(summary.uniqueKeys === 14, "20 unique keys");
  must(summary.audio === 12 && summary.video === 2, "audio/video");
  must(summary.bytes === MIGRATION_EXPECTED_BYTES, "bytes");
  must(summary.keysMatch, "deterministic keys");
  for (const item of BLOB_TO_R2_MIGRATION_MANIFEST) {
    must(planPortfolioR2ObjectKey(item.pathname, item.mediaKind) === item.plannedKey, `key ${item.id}`);
  }

  const preview = await runCase(copyRequest(), { env: "preview" });
  must(preview.result.httpStatus === 403 && preview.result.body.status === "NOT_PRODUCTION", "1 preview");
  must(preview.calls.admin === 0 && preview.calls.put === 0 && preview.calls.sourceHead === 0, "1 no storage");

  const dev = await runCase(copyRequest(), { env: "development" });
  must(dev.result.body.status === "NOT_PRODUCTION" && dev.calls.put === 0, "1 development");

  const anonymous = await runCase(copyRequest(), { admin: "anonymous" });
  must(anonymous.result.httpStatus === 401 && anonymous.result.body.status === "AUTH_FAILURE", "2 anonymous");
  must(!JSON.stringify(anonymous.result.body).includes("Não autenticado"), "2 no session text");
  must(anonymous.calls.sourceHead === 0 && anonymous.calls.put === 0, "2 no storage");

  const forbidden = await runCase(copyRequest(), { admin: "forbidden" });
  must(forbidden.result.httpStatus === 403 && forbidden.result.body.status === "AUTH_FAILURE", "3 forbidden");
  must(forbidden.calls.put === 0 && forbidden.calls.sourceHead === 0, "3 no storage");

  const operation = await runCase({ operation: "delete", confirm: "YES", id: "04" });
  must(operation.result.httpStatus === 400 && operation.result.body.status === "INVALID_REQUEST", "4 operation");
  must(operation.calls.put === 0, "4 no put");

  const confirm = await runCase({ operation: "copy", confirm: "NO", id: "04" });
  must(confirm.result.body.status === "INVALID_REQUEST" && confirm.calls.put === 0, "5 confirm");

  const unknown = await runCase(copyRequest("99"));
  must(unknown.result.httpStatus === 400 && unknown.result.body.status === "UNKNOWN_ID", "6 id");
  must(unknown.calls.sourceHead === 0 && unknown.calls.put === 0, "6 no storage");

  const pathname = await runCase(copyRequest("04", { pathname: "portfolio/audio/other.mp3" }));
  must(pathname.result.body.status === "INVALID_REQUEST" && pathname.calls.put === 0, "7 pathname");
  must(pathname.calls.sourceHead === 0, "7 ignored");

  const clientKey = await runCase(copyRequest("04", { r2Key: "portfolio/audio/other.mp3" }));
  must(clientKey.result.body.status === "INVALID_REQUEST" && clientKey.calls.put === 0 && clientKey.calls.sourceHead === 0, "8 key");

  const bucket = await runCase(copyRequest("04", { bucket: "other-bucket" }));
  must(bucket.result.body.status === "INVALID_REQUEST" && bucket.calls.put === 0, "bucket rejected");

  const sizeMismatch = await runCase(copyRequest(), { sourceSize: ITEM.size - 1 });
  must(sizeMismatch.result.body.status === "SOURCE_MISMATCH", "9 status");
  must(sizeMismatch.calls.put === 0 && sizeMismatch.calls.sourceGet === 0 && sizeMismatch.calls.targetHead === 0, "9 no put");

  const keyMismatch = await runCase(copyRequest(), { planKey: () => "portfolio/audio/00000000-0000-5000-8000-000000000000.mp3" });
  must(keyMismatch.result.body.status === "KEY_MISMATCH", "10 status");
  must(keyMismatch.calls.put === 0 && keyMismatch.calls.sourceHead === 0, "10 no put");

  const same = await runCase(copyRequest(), { destination: { exists: true, size: ITEM.size, contentType: ITEM.contentType } });
  must(same.result.body.status === "SKIPPED_ALREADY_VERIFIED" && same.result.body.hashMatch === true, "11 status");
  must(same.calls.put === 0 && same.calls.targetGet === 1, "11 no put");
  must(same.result.body.sourceSha256 === sha256Hex(same.sourceBytes), "11 hash");

  const destSize = await runCase(copyRequest(), { destination: { exists: true, size: ITEM.size + 5, contentType: ITEM.contentType } });
  must(destSize.result.body.status === "DESTINATION_CONFLICT_SIZE", "12 status");
  must(destSize.calls.put === 0 && destSize.calls.targetGet === 0, "12 no put");

  const destHash = await runCase(copyRequest(), {
    destination: { exists: true, size: ITEM.size, contentType: ITEM.contentType },
    destinationBytes: Buffer.alloc(ITEM.size, 9),
  });
  must(destHash.result.body.status === "DESTINATION_CONFLICT_HASH" && destHash.result.body.hashMatch === false, "13 status");
  must(destHash.calls.put === 0, "13 no put");

  const verified = await runCase(copyRequest());
  must(verified.result.httpStatus === 200 && verified.result.body.status === "VERIFIED", "14 status");
  must(verified.result.body.hashMatch === true, "14 hash");
  must(verified.calls.put === 1 && verified.calls.targetGet === 1, "14 one put");
  must(verified.result.body.r2Key === ITEM.plannedKey, "14 key");
  must(verified.result.body.destinationSize === ITEM.size, "14 size");

  const badSize = await runCase(copyRequest(), {
    verifiedHead: { exists: true, size: ITEM.size - 1, contentType: ITEM.contentType },
  });
  must(badSize.result.body.status === "PUT_COMPLETED_BUT_VERIFICATION_FAILED", "15 status");
  must(badSize.calls.put === 1 && badSize.calls.targetGet === 0, "15 no second read and no delete");

  const badHash = await runCase(copyRequest(), { verifiedBytes: Buffer.alloc(ITEM.size, 3) });
  must(badHash.result.body.status === "PUT_COMPLETED_BUT_VERIFICATION_FAILED", "16 status");
  must(badHash.calls.put === 1, "16 single put");
  must(badHash.result.body.hashMatch === false, "16 hash");

  const batch = await runCase({ operation: "copy", confirm: "YES", ids: ["01", "02"] });
  must(batch.result.body.status === "INVALID_REQUEST" && batch.calls.put === 0, "17 batch");
  const many = await runCase({ operation: "copy", confirm: "YES", id: ["01", "02"] });
  must(many.result.body.status === "INVALID_REQUEST" && many.calls.put === 0, "17 array id");

  const routePath = path.join(process.cwd(), "src/app/api/admin/portfolio/blob-to-r2-migration/route.ts");
  const executePath = path.join(process.cwd(), "src/app/api/admin/portfolio/blob-to-r2-migration/execute.ts");
  const routeSource = fs.readFileSync(routePath, "utf8");
  const executeSource = fs.readFileSync(executePath, "utf8");
  must(routeSource.includes("TEMPORARY MIGRATION TOOL"), "route marker");
  must(routeSource.includes("export async function POST"), "POST");
  must(!/export async function (GET|PUT|PATCH|DELETE)/.test(routeSource), "other methods");
  must(routeSource.includes('requireAdmin'), "auth");
  must(routeSource.includes("portfolioWriteBucketAllowed"), "bucket gate");
  must(executeSource.includes('export const MIGRATION_BUCKET = "thouse-portfolio"'), "fixed bucket");
  must(routeSource.includes("MIGRATION_BUCKET"), "route bucket constant");
  must(!/DeleteObject|\bdel\(/.test(routeSource + executeSource), "no delete");
  must(!/portfolio-store|savePortfolio|publishPortfolio|prisma\./.test(routeSource + executeSource), "no portfolio write");
  must(!/Metadata:/.test(routeSource), "no extra metadata");
  must(routeSource.includes('IfNoneMatch: "*"'), "create-only put");
  must(routeSource.includes('dynamic = "force-dynamic"'), "dynamic");
  must(routeSource.includes('runtime = "nodejs"'), "nodejs runtime");
  must(routeSource.includes("no-store"), "no store");
  must(!/console\.(log|error|debug|info)/.test(routeSource + executeSource), "no logs");

  const repeated = await runCase(copyRequest(), { destination: { exists: true, size: ITEM.size, contentType: ITEM.contentType } });
  must(repeated.result.body.status === "SKIPPED_ALREADY_VERIFIED" && repeated.calls.put === 0, "idempotent repeat");

  const extraPath = await runCase(copyRequest("04", { pathname: "portfolio/audio/injected.mp3" }));
  must(extraPath.result.body.status === "INVALID_REQUEST" && extraPath.calls.put === 0 && extraPath.calls.sourceHead === 0, "21 pathname");
  const extraKey = await runCase(copyRequest("04", { key: "portfolio/audio/injected.mp3" }));
  must(extraKey.result.body.status === "INVALID_REQUEST" && extraKey.calls.put === 0, "22 key");
  const extraBucket = await runCase(copyRequest("04", { bucket: "thouse-portfolio-preview" }));
  must(extraBucket.result.body.status === "INVALID_REQUEST" && extraBucket.calls.put === 0, "23 bucket");
  const unknownField = await runCase(copyRequest("04", { note: "x" }));
  must(unknownField.result.body.status === "INVALID_REQUEST" && unknownField.calls.sourceHead === 0, "24 unknown");
  const urlField = await runCase(copyRequest("04", { url: "https://example.invalid/a" }));
  must(urlField.result.body.status === "INVALID_REQUEST", "24 url");
  const sizeField = await runCase(copyRequest("04", { size: 1 }));
  must(sizeField.result.body.status === "INVALID_REQUEST", "24 size");
  const typeField = await runCase(copyRequest("04", { contentType: "text/plain" }));
  must(typeField.result.body.status === "INVALID_REQUEST", "24 contentType");

  const arrayBody = await runCase([{ operation: "copy", confirm: "YES", id: "04" }]);
  must(arrayBody.result.body.status === "INVALID_REQUEST" && arrayBody.calls.put === 0, "25 array");

  function jsonRequest(body: string, contentType = "application/json") {
    return new Request("https://example.invalid/migration", {
      method: "POST",
      headers: { "content-type": contentType, "content-length": String(Buffer.byteLength(body)) },
      body,
    });
  }
  const malformed = await readMigrationBody(jsonRequest("{"));
  must(!malformed.ok, "26 malformed");
  const notJson = await readMigrationBody(jsonRequest("{}", "text/plain"));
  must(!notJson.ok, "26 content type");
  const oversized = "x".repeat(MIGRATION_MAX_BODY_BYTES + 50);
  const tooBig = await readMigrationBody(jsonRequest(oversized));
  must(!tooBig.ok, "26 size");
  const parsedArray = await readMigrationBody(jsonRequest('[{"operation":"copy"}]'));
  must(parsedArray.ok, "25 parse array");
  if (parsedArray.ok) {
    const rejected = await runTemporaryBlobToR2Migration(parsedArray.body, harness({}).deps);
    must(rejected.body.status === "INVALID_REQUEST", "25 parsed array");
  }

  const racedSame = await runCase(copyRequest(), {
    putConflict: { head: { exists: true, size: ITEM.size, contentType: ITEM.contentType } },
  });
  must(racedSame.calls.put === 1 && racedSame.calls.stored === 0, "27 not overwritten");
  must(racedSame.result.body.status === "SKIPPED_ALREADY_VERIFIED" && racedSame.result.body.hashMatch === true, "28 identical");

  const racedSize = await runCase(copyRequest(), {
    putConflict: { head: { exists: true, size: ITEM.size + 8, contentType: ITEM.contentType } },
  });
  must(racedSize.result.body.status === "DESTINATION_CONFLICT_SIZE" && racedSize.calls.stored === 0, "29 size");
  must(racedSize.calls.put === 1, "29 single conditional attempt");

  const racedHash = await runCase(copyRequest(), {
    putConflict: {
      head: { exists: true, size: ITEM.size, contentType: ITEM.contentType },
      bytes: Buffer.alloc(ITEM.size, 4),
    },
  });
  must(racedHash.result.body.status === "DESTINATION_CONFLICT_HASH" && racedHash.calls.stored === 0, "30 hash");
  must(racedHash.result.body.hashMatch === false, "30 hash flag");

  const leaked = await runCase(copyRequest(), { admin: "ok" });
  const secretAdmin = harness({
    admin: "ok",
  });
  secretAdmin.deps.requireAdmin = async () => {
    throw new Error("BLOB_TOKEN=secret-value DATABASE_URL=postgres://user:pass@host/db");
  };
  const secretResult = await runTemporaryBlobToR2Migration(copyRequest(), secretAdmin.deps);
  const secretText = JSON.stringify(secretResult.body);
  must(secretResult.body.status === "AUTH_FAILURE", "31 auth");
  must(!secretText.includes("secret-value") && !secretText.includes("postgres"), "31 no secret");
  const sourceSecret = harness({});
  sourceSecret.deps.headSource = async () => {
    throw new Error("authorization Bearer token-value");
  };
  const sourceResult = await runTemporaryBlobToR2Migration(copyRequest(), sourceSecret.deps);
  must(sourceResult.body.status === "SOURCE_UNAVAILABLE", "31 source");
  must(!JSON.stringify(sourceResult.body).includes("token-value") && !JSON.stringify(sourceResult.body).includes("Bearer"), "31 no header");
  must(leaked.calls.put === 1, "31 control still verifies");

  must(!/export async function (GET|PUT|PATCH|DELETE)/.test(routeSource), "32 only post");
  must(routeSource.includes("export async function POST"), "32 post");

  console.log("[portfolio-blob-to-r2-migration-smoke] PASS");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "error";
  console.error("[portfolio-blob-to-r2-migration-smoke] FAIL", message);
  process.exit(1);
});
