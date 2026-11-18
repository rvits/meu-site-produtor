/**
 * Planner Blob Portfolio → R2.
 * Dry-run não escreve. Copy só com --execute + --target-bucket + --confirm-copy + --id.
 * Não altera PortfolioState. Não apaga Blob. Não lista o store inteiro.
 */

import { createHash } from "node:crypto";
import {
  acceptedPortfolioR2ObjectKey,
  classifyPortfolioStorageReference,
  parsePortfolioMedia,
  portfolioMediaKind,
  type PortfolioMediaKind,
  type PortfolioMediaRef,
} from "@/app/portfolio/portfolio-media-ref";
import { isExplicitR2BucketName } from "./r2-config";

const PLAN_NAMESPACE = "thouse-portfolio-blob-to-r2-v1";
const FOLDER: Record<PortfolioMediaKind, "images" | "audio" | "videos"> = {
  image: "images",
  audio: "audio",
  video: "videos",
};

export type PlanOrigin = "DRAFT" | "PUBLISHED";
export type PlanStatus = "PLANNED" | "SKIPPED_ALREADY_R2" | "REJECTED";

export type PortfolioMigrationCandidate = {
  logicalId: string;
  source: "BLOB";
  pathname: string;
  url: string;
  mediaKind: PortfolioMediaKind;
  mimeType: string;
  originalName: string;
  size: number;
  targetKey: string;
  origins: PlanOrigin[];
  status: "PLANNED";
};

export type PortfolioMigrationSkip = {
  pathname: string;
  status: "SKIPPED_ALREADY_R2";
  mediaKind: PortfolioMediaKind | null;
};

export type PortfolioMigrationReject = {
  status: "REJECTED";
  reason: string;
  mediaKind: string | null;
};

export type PortfolioMigrationPlan = {
  candidates: PortfolioMigrationCandidate[];
  skippedAlreadyR2: PortfolioMigrationSkip[];
  rejected: PortfolioMigrationReject[];
  counts: {
    uniqueCandidates: number;
    audio: number;
    video: number;
    image: number;
    skippedAlreadyR2: number;
    rejected: number;
  };
};

export type SanitizedPlanRow = {
  logicalId: string;
  source: "BLOB";
  kind: PortfolioMediaKind;
  target: string;
  origins: "DRAFT_ONLY" | "PUBLISHED_ONLY" | "BOTH";
  size: number;
  status: "PLANNED";
};

export type CopyVerifyInput = {
  sourceSize: number;
  sourceHash: string;
  sourceContentType: string;
  targetSize: number | null;
  targetHash: string;
  targetContentType: string | null;
};

export type CopyVerifyResult =
  | { ok: true }
  | { ok: false; reason: "size_mismatch" | "hash_mismatch" | "type_mismatch" };

export type CopyDeps = {
  getSourceBytes: (url: string) => Promise<Buffer>;
  putTarget: (input: {
    bucket: string;
    objectKey: string;
    bytes: Buffer;
    contentType: string;
  }) => Promise<void>;
  getTargetBytes: (input: { bucket: string; objectKey: string }) => Promise<Buffer>;
  headTarget: (input: { bucket: string; objectKey: string }) => Promise<{
    size: number | null;
    contentType: string | null;
  }>;
};

export type ExecuteCopyInput = {
  candidate: PortfolioMigrationCandidate;
  targetBucket: string;
  confirmCopy: "YES";
  id: string;
};

const FORBIDDEN_PREFIXES = ["deliveries/", "avatars/"];

function extensionOf(name: string): string {
  const match = /\.(jpg|jpeg|png|mp3|wav|mp4|mov)$/i.exec(name.trim());
  return match ? match[0].toLowerCase() : "";
}

function forbiddenPath(pathname: string): boolean {
  const p = pathname.replace(/\\/g, "/").replace(/^\//, "");
  return FORBIDDEN_PREFIXES.some((prefix) => p.startsWith(prefix));
}

export function deterministicPortfolioR2Uuid(pathname: string): string {
  const digest = createHash("sha256").update(PLAN_NAMESPACE).update("\0").update(pathname).digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function planPortfolioR2ObjectKey(pathname: string, mediaKind: PortfolioMediaKind): string | null {
  const ext = extensionOf(pathname);
  if (!ext) return null;
  const id = deterministicPortfolioR2Uuid(pathname);
  const key = `portfolio/${FOLDER[mediaKind]}/${id}${ext}`;
  return acceptedPortfolioR2ObjectKey(key) ? key : null;
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function verifyCopiedObject(input: CopyVerifyInput): CopyVerifyResult {
  if (!Number.isFinite(input.sourceSize) || input.sourceSize <= 0) return { ok: false, reason: "size_mismatch" };
  if (input.targetSize !== input.sourceSize) return { ok: false, reason: "size_mismatch" };
  if (input.sourceHash !== input.targetHash) return { ok: false, reason: "hash_mismatch" };
  const sourceType = input.sourceContentType.split(";")[0].trim().toLowerCase();
  const targetType = String(input.targetContentType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (targetType && sourceType && targetType !== sourceType) return { ok: false, reason: "type_mismatch" };
  return { ok: true };
}

function walkDocuments(documents: { draft?: unknown; published?: unknown }) {
  return [
    { origin: "DRAFT" as const, doc: documents.draft },
    { origin: "PUBLISHED" as const, doc: documents.published },
  ];
}

function eachBlock(doc: unknown, visit: (kind: string, media: unknown) => void) {
  if (!doc || typeof doc !== "object") return;
  const sections = (doc as { sections?: unknown }).sections;
  if (!sections || typeof sections !== "object") return;
  for (const blocks of Object.values(sections as Record<string, unknown>)) {
    if (!Array.isArray(blocks)) continue;
    for (const block of blocks) {
      if (!block || typeof block !== "object") continue;
      const kind = String((block as { kind?: unknown }).kind || "");
      visit(kind, (block as { media?: unknown }).media);
    }
  }
}

export function planPortfolioBlobToR2(documents: {
  draft?: unknown;
  published?: unknown;
}): PortfolioMigrationPlan {
  const blobByPath = new Map<
    string,
    {
      media: PortfolioMediaRef;
      mediaKind: PortfolioMediaKind;
      origins: Set<PlanOrigin>;
    }
  >();
  const skippedAlreadyR2: PortfolioMigrationSkip[] = [];
  const skippedR2Keys = new Set<string>();
  const rejected: PortfolioMigrationReject[] = [];

  for (const { origin, doc } of walkDocuments(documents)) {
    eachBlock(doc, (kind, media) => {
      if (media == null) return;
      const mediaKind = portfolioMediaKind(kind as "image" | "audio" | "video");
      if (!mediaKind) {
        rejected.push({ status: "REJECTED", reason: "block_without_media_kind", mediaKind: kind || null });
        return;
      }
      const parsed = parsePortfolioMedia(media, mediaKind);
      if (!parsed.ok) {
        rejected.push({ status: "REJECTED", reason: parsed.error, mediaKind });
        return;
      }
      if (!parsed.media) return;
      const classified = classifyPortfolioStorageReference(parsed.media.url, parsed.media.pathname);
      if (classified.kind === "r2") {
        if (!skippedR2Keys.has(classified.objectKey)) {
          skippedR2Keys.add(classified.objectKey);
          skippedAlreadyR2.push({
            pathname: classified.objectKey,
            status: "SKIPPED_ALREADY_R2",
            mediaKind: classified.mediaKind,
          });
        }
        return;
      }
      if (classified.kind !== "blob") {
        rejected.push({ status: "REJECTED", reason: classified.reason, mediaKind });
        return;
      }
      if (forbiddenPath(classified.pathname)) {
        rejected.push({ status: "REJECTED", reason: "forbidden_namespace", mediaKind });
        return;
      }
      const current = blobByPath.get(classified.pathname);
      if (current) {
        current.origins.add(origin);
        return;
      }
      blobByPath.set(classified.pathname, {
        media: parsed.media,
        mediaKind,
        origins: new Set([origin]),
      });
    });
  }

  const candidates: PortfolioMigrationCandidate[] = [];
  const sortedPaths = [...blobByPath.keys()].sort();
  let index = 0;
  for (const pathname of sortedPaths) {
    const row = blobByPath.get(pathname);
    if (!row) continue;
    const targetKey = planPortfolioR2ObjectKey(pathname, row.mediaKind);
    if (!targetKey) {
      rejected.push({ status: "REJECTED", reason: "target_key_invalid", mediaKind: row.mediaKind });
      continue;
    }
    index += 1;
    candidates.push({
      logicalId: `PORTFOLIO-${String(index).padStart(3, "0")}`,
      source: "BLOB",
      pathname,
      url: row.media.url,
      mediaKind: row.mediaKind,
      mimeType: row.media.mimeType,
      originalName: row.media.originalName,
      size: row.media.size,
      targetKey,
      origins: [...row.origins].sort() as PlanOrigin[],
      status: "PLANNED",
    });
  }

  return {
    candidates,
    skippedAlreadyR2,
    rejected,
    counts: {
      uniqueCandidates: candidates.length,
      audio: candidates.filter((item) => item.mediaKind === "audio").length,
      video: candidates.filter((item) => item.mediaKind === "video").length,
      image: candidates.filter((item) => item.mediaKind === "image").length,
      skippedAlreadyR2: skippedAlreadyR2.length,
      rejected: rejected.length,
    },
  };
}

export function sanitizeMigrationPlan(plan: PortfolioMigrationPlan): SanitizedPlanRow[] {
  return plan.candidates.map((item) => ({
    logicalId: item.logicalId,
    source: "BLOB",
    kind: item.mediaKind,
    target: item.targetKey,
    origins: item.origins.includes("DRAFT") && item.origins.includes("PUBLISHED")
      ? "BOTH"
      : item.origins.includes("PUBLISHED")
        ? "PUBLISHED_ONLY"
        : "DRAFT_ONLY",
    size: item.size,
    status: "PLANNED",
  }));
}

export type ParsedMigrateArgs =
  | { ok: false; error: string }
  | { ok: true; mode: "dry-run" }
  | {
      ok: true;
      mode: "execute";
      targetBucket: string;
      confirmCopy: "YES";
      id: string;
    };

export function parsePortfolioMigrateArgs(argv: string[]): ParsedMigrateArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "--execute") {
      flags.add(arg);
      continue;
    }
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match) return { ok: false, error: "argumento inválido" };
    values.set(match[1], match[2]);
  }
  if (flags.has("--dry-run") && flags.has("--execute")) {
    return { ok: false, error: "use somente --dry-run ou --execute" };
  }
  if (!flags.has("--dry-run") && !flags.has("--execute")) {
    return { ok: false, error: "informe --dry-run ou --execute" };
  }
  if (flags.has("--dry-run")) {
    if (values.has("target-bucket") || values.has("confirm-copy") || values.has("id")) {
      return { ok: false, error: "dry-run não aceita flags de escrita" };
    }
    return { ok: true, mode: "dry-run" };
  }
  const targetBucket = String(values.get("target-bucket") || "").trim();
  const confirmCopy = String(values.get("confirm-copy") || "").trim();
  const id = String(values.get("id") || "").trim();
  if (!targetBucket) return { ok: false, error: "--target-bucket é obrigatório para --execute" };
  if (!isExplicitR2BucketName(targetBucket)) return { ok: false, error: "--target-bucket inválido" };
  if (confirmCopy !== "YES") return { ok: false, error: "--confirm-copy=YES é obrigatório para --execute" };
  if (!/^PORTFOLIO-\d{3}$/.test(id)) return { ok: false, error: "--id=PORTFOLIO-00N é obrigatório para --execute" };
  return { ok: true, mode: "execute", targetBucket, confirmCopy: "YES", id };
}

export async function copyOnePortfolioCandidate(
  input: ExecuteCopyInput,
  deps: CopyDeps
): Promise<{ ok: true; hash: string; size: number } | { ok: false; status: "FAILED"; reason: string }> {
  if (input.confirmCopy !== "YES") return { ok: false, status: "FAILED", reason: "confirm_required" };
  if (!isExplicitR2BucketName(input.targetBucket)) {
    return { ok: false, status: "FAILED", reason: "target_bucket_required" };
  }
  if (input.id !== input.candidate.logicalId) {
    return { ok: false, status: "FAILED", reason: "id_mismatch" };
  }
  if (input.candidate.status !== "PLANNED" || input.candidate.source !== "BLOB") {
    return { ok: false, status: "FAILED", reason: "not_copy_candidate" };
  }
  if (!acceptedPortfolioR2ObjectKey(input.candidate.targetKey)) {
    return { ok: false, status: "FAILED", reason: "target_key_invalid" };
  }
  let sourceBytes: Buffer;
  try {
    sourceBytes = await deps.getSourceBytes(input.candidate.url);
  } catch {
    return { ok: false, status: "FAILED", reason: "source_get_failed" };
  }
  const sourceHash = sha256Hex(sourceBytes);
  if (sourceBytes.length !== input.candidate.size) {
    return { ok: false, status: "FAILED", reason: "size_mismatch" };
  }
  try {
    await deps.putTarget({
      bucket: input.targetBucket,
      objectKey: input.candidate.targetKey,
      bytes: sourceBytes,
      contentType: input.candidate.mimeType,
    });
  } catch {
    return { ok: false, status: "FAILED", reason: "put_failed" };
  }
  let headed: { size: number | null; contentType: string | null };
  let targetBytes: Buffer;
  try {
    headed = await deps.headTarget({
      bucket: input.targetBucket,
      objectKey: input.candidate.targetKey,
    });
    targetBytes = await deps.getTargetBytes({
      bucket: input.targetBucket,
      objectKey: input.candidate.targetKey,
    });
  } catch {
    return { ok: false, status: "FAILED", reason: "target_read_failed" };
  }
  const checked = verifyCopiedObject({
    sourceSize: sourceBytes.length,
    sourceHash,
    sourceContentType: input.candidate.mimeType,
    targetSize: headed.size ?? targetBytes.length,
    targetHash: sha256Hex(targetBytes),
    targetContentType: headed.contentType || input.candidate.mimeType,
  });
  if (!checked.ok) return { ok: false, status: "FAILED", reason: checked.reason };
  return { ok: true, hash: sourceHash, size: sourceBytes.length };
}

export function inspectProductionDatabaseUrl(raw: string | undefined): {
  host_prefix: string;
  database: string;
  production_match: "YES" | "NO";
  preview_match: "YES" | "NO";
} {
  if (!raw || !String(raw).trim()) {
    return { host_prefix: "ABSENT", database: "ABSENT", production_match: "NO", preview_match: "NO" };
  }
  try {
    const u = new URL(String(raw).trim());
    const hostPrefix = String(u.hostname || "").split(".")[0] || "ABSENT";
    const database = decodeURIComponent(String(u.pathname || "").replace(/^\//, "").split("?")[0] || "ABSENT");
    return {
      host_prefix: hostPrefix,
      database,
      production_match: hostPrefix === "ep-soft-snow-acu3sq1b-pooler" ? "YES" : "NO",
      preview_match: hostPrefix === "ep-patient-truth-aci27413-pooler" ? "YES" : "NO",
    };
  } catch {
    return { host_prefix: "PARSE_FAIL", database: "PARSE_FAIL", production_match: "NO", preview_match: "NO" };
  }
}
