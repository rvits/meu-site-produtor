/**
 * TEMPORARY CUTOVER TOOL
 * Troca atômica das 14 refs Blob já verificadas para as 14 refs R2 já verificadas.
 * Não lê Blob, não escreve R2 e não implementa rollback.
 * O SHA-256 do snapshot anterior é auditoria, não restauração.
 */

import { createHash } from "node:crypto";
import {
  BLOB_TO_R2_MIGRATION_MANIFEST,
  type MigrationManifestItem,
  type MigrationMediaKind,
} from "@/app/api/admin/portfolio/blob-to-r2-migration/execute";
import { planPortfolioR2ObjectKey } from "@/app/lib/storage/portfolio-blob-to-r2";
import { documentHasUnpersistedMedia, samePortfolio } from "@/app/portfolio/portfolio-data";
import { classifyPortfolioStorageReference } from "@/app/portfolio/portfolio-media-ref";
import { validatePortfolioDocument } from "@/app/portfolio/portfolio-validate";

export const CUTOVER_ROW_ID = "default";
export const CUTOVER_EXPECTED_DRAFT_VERSION = 10;
export const CUTOVER_EXPECTED_PUBLISHED_VERSION = 10;
export const CUTOVER_NEXT_VERSION = 11;
export const CUTOVER_EXPECTED_DRAFT_UPDATED_AT = new Date("2026-11-20T20:27:58.234Z");
export const CUTOVER_EXPECTED_PUBLISHED_AT = new Date("2026-11-20T20:28:01.795Z");
export const CUTOVER_MAX_BODY_BYTES = 1024;

const ALLOWED_BODY_KEYS = new Set(["operation", "confirm"]);

/**
 * SHA-256 hex do JSON canônico deste objeto, e só dele:
 * draftDocument, draftUpdatedAt (ISO-8601), draftVersion,
 * publishedAt (ISO-8601), publishedDocument, publishedVersion.
 * Chaves de objeto ordenadas em todos os níveis. A ordem dos arrays permanece.
 * Não inclui createdAt, updatedAt, credenciais nem URLs assinadas.
 * Não restaura o documento.
 */
export type CutoverSnapshotFingerprintInput = {
  draftDocument: unknown;
  publishedDocument: unknown;
  draftVersion: number;
  publishedVersion: number;
  draftUpdatedAt: string;
  publishedAt: string;
};

export type CutoverCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NON_PRODUCTION"
  | "INVALID_REQUEST"
  | "STATE_DRIFT"
  | "MANIFEST_MISMATCH"
  | "DOCUMENT_INVALID"
  | "MEDIA_INVENTORY_MISMATCH"
  | "CONCURRENT_UPDATE"
  | "POST_WRITE_VERIFICATION_FAILED"
  | "INTERNAL_ERROR"
  | "CUTOVER_VERIFIED";

export type CutoverSuccessBody = {
  status: "CUTOVER_VERIFIED";
  oldDraftVersion: number;
  newDraftVersion: number;
  oldPublishedVersion: number;
  newPublishedVersion: number;
  oldDraftUpdatedAt: string;
  newDraftUpdatedAt: string;
  oldPublishedAt: string;
  newPublishedAt: string;
  draftSubstitutions: number;
  publishedSubstitutions: number;
  draftLegacyRemaining: number;
  publishedLegacyRemaining: number;
  draftR2Present: number;
  publishedR2Present: number;
  documentsDiffer: boolean;
  previousSnapshotSha256: string;
};

export type CutoverResponse = {
  httpStatus: number;
  body: CutoverSuccessBody | { error: CutoverCode; status: CutoverCode };
};

export type CutoverRow = {
  id: string;
  draftDocument: unknown;
  publishedDocument: unknown;
  draftVersion: number;
  publishedVersion: number;
  draftUpdatedAt: Date;
  publishedAt: Date | null;
};

export type CutoverWriteWhere = {
  id: string;
  draftVersion: number;
  publishedVersion: number;
  draftUpdatedAt: Date;
  publishedAt: Date;
};

export type CutoverWriteData = {
  draftDocument: unknown;
  publishedDocument: unknown;
  draftVersion: number;
  publishedVersion: number;
  draftUpdatedAt: Date;
  publishedAt: Date;
};

export type CutoverTx = {
  read: () => Promise<CutoverRow | null>;
  updateMany: (input: { where: CutoverWriteWhere; data: CutoverWriteData }) => Promise<{ count: number }>;
};

export type CutoverDeps = {
  vercelEnv: string | undefined;
  requireAdmin: () => Promise<void>;
  transaction: (run: (tx: CutoverTx) => Promise<void>) => Promise<void>;
  now?: () => Date;
  planKey?: (pathname: string, mediaKind: MigrationMediaKind) => string | null;
  manifest?: readonly MigrationManifestItem[];
};

class CutoverAbort extends Error {
  readonly response: CutoverResponse;

  constructor(response: CutoverResponse) {
    super("cutover_abort");
    this.name = "CutoverAbort";
    this.response = response;
  }
}

function fail(httpStatus: number, code: Exclude<CutoverCode, "CUTOVER_VERIFIED">): CutoverResponse {
  return { httpStatus, body: { error: code, status: code } };
}

export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("non_finite");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(",")}}`;
  }
  throw new Error("unsupported");
}

export function canonicalCutoverSnapshotSha256(input: CutoverSnapshotFingerprintInput): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

export async function readCutoverBody(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  if (type !== "application/json") return { ok: false };
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > CUTOVER_MAX_BODY_BYTES)) {
    return { ok: false };
  }
  if (!request.body) return { ok: false };
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;
  try {
    while (true) {
      const step = await reader.read();
      if (step.done) break;
      if (!step.value) continue;
      received += step.value.byteLength;
      if (received > CUTOVER_MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return { ok: false };
      }
      chunks.push(step.value);
    }
  } catch {
    return { ok: false };
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(concatBytes(chunks));
    return { ok: true, body: JSON.parse(text) as unknown };
  } catch {
    return { ok: false };
  }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

function parseCutoverRequest(body: unknown): { ok: true } | { ok: false } {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false };
  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== ALLOWED_BODY_KEYS.size || keys.some((key) => !ALLOWED_BODY_KEYS.has(key))) return { ok: false };
  if (record.operation !== "cutover" || record.confirm !== "YES") return { ok: false };
  return { ok: true };
}

function manifestReady(
  manifest: readonly MigrationManifestItem[],
  planKey: (pathname: string, mediaKind: MigrationMediaKind) => string | null
): boolean {
  if (manifest.length !== 14) return false;
  if (manifest.filter((item) => item.mediaKind === "audio").length !== 12) return false;
  if (manifest.filter((item) => item.mediaKind === "video").length !== 2) return false;
  const ids = new Set(manifest.map((item) => item.id));
  const pathnames = new Set(manifest.map((item) => item.pathname));
  const keys = new Set(manifest.map((item) => item.plannedKey));
  if (ids.size !== 14 || pathnames.size !== 14 || keys.size !== 14) return false;
  return manifest.every((item) => planKey(item.pathname, item.mediaKind) === item.plannedKey);
}

function sameInstant(left: Date | null, right: Date): boolean {
  return left instanceof Date && !Number.isNaN(left.getTime()) && left.getTime() === right.getTime();
}

type RawBlock = Record<string, unknown>;

function walkBlocks(doc: unknown, visit: (block: RawBlock) => void): boolean {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return false;
  const sections = (doc as { sections?: unknown }).sections;
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) return false;
  for (const blocks of Object.values(sections as Record<string, unknown>)) {
    if (!Array.isArray(blocks)) return false;
    for (const block of blocks) {
      if (!block || typeof block !== "object" || Array.isArray(block)) return false;
      visit(block as RawBlock);
    }
  }
  return true;
}

function mimeOf(value: unknown): string {
  return typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : "";
}

function storageOf(url: string, pathname: string): "blob" | "r2" | "other" {
  if (url.startsWith("r2:")) return "r2";
  const classified = classifyPortfolioStorageReference(url, pathname);
  if (classified.kind === "blob") return "blob";
  if (classified.kind === "r2") return "r2";
  return "other";
}

function hasPreviewOnly(doc: unknown): boolean {
  let found = false;
  const walked = walkBlocks(doc, (block) => {
    if (block.previewOnly === true) found = true;
  });
  return walked && found;
}

function inventoryMatches(doc: unknown, byPath: Map<string, MigrationManifestItem>, plannedKeys: Set<string>): boolean {
  const seen = new Map<string, number>();
  let blob = 0;
  let r2 = 0;
  let other = 0;
  let srcMismatch = 0;
  const walked = walkBlocks(doc, (block) => {
    if (block.media == null) return;
    if (!block.media || typeof block.media !== "object" || Array.isArray(block.media)) {
      other += 1;
      return;
    }
    const media = block.media as Record<string, unknown>;
    const url = typeof media.url === "string" ? media.url : "";
    const pathname = typeof media.pathname === "string" ? media.pathname : "";
    const storage = storageOf(url, pathname);
    if (storage === "r2" || plannedKeys.has(pathname)) {
      r2 += 1;
      return;
    }
    if (storage !== "blob") {
      other += 1;
      return;
    }
    blob += 1;
    seen.set(pathname, (seen.get(pathname) || 0) + 1);
    if (block.src !== url) srcMismatch += 1;
    const item = byPath.get(pathname);
    if (!item) return;
    if (block.kind !== item.mediaKind) other += 1;
    if (media.originalName !== item.originalName) other += 1;
    if (media.size !== item.size) other += 1;
    if (mimeOf(media.mimeType) !== mimeOf(item.contentType)) other += 1;
  });
  if (!walked || srcMismatch !== 0 || r2 !== 0 || other !== 0 || blob !== 14 || seen.size !== 14) return false;
  for (const item of byPath.values()) {
    if (seen.get(item.pathname) !== 1) return false;
  }
  return true;
}

function stripStorage(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => stripStorage(item));
  if (!value || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (key === "src") continue;
    if (key === "media" && record.media && typeof record.media === "object" && !Array.isArray(record.media)) {
      const media = record.media as Record<string, unknown>;
      const kept: Record<string, unknown> = {};
      for (const mediaKey of Object.keys(media)) {
        if (mediaKey === "url" || mediaKey === "pathname") continue;
        kept[mediaKey] = stripStorage(media[mediaKey]);
      }
      next.media = kept;
      continue;
    }
    next[key] = stripStorage(record[key]);
  }
  return next;
}

function storagePreserved(before: unknown, after: unknown): boolean {
  try {
    return canonicalJson(stripStorage(before)) === canonicalJson(stripStorage(after));
  } catch {
    return false;
  }
}

function transformDocument(
  raw: unknown,
  byPath: Map<string, MigrationManifestItem>
): { document: unknown; substitutions: number } | null {
  let document: unknown;
  try {
    document = structuredClone(raw);
  } catch {
    return null;
  }
  let substitutions = 0;
  const walked = walkBlocks(document, (block) => {
    if (!block.media || typeof block.media !== "object" || Array.isArray(block.media)) return;
    const media = block.media as Record<string, unknown>;
    if (typeof media.pathname !== "string") return;
    const item = byPath.get(media.pathname);
    if (!item) return;
    const reference = `r2:${item.plannedKey}`;
    media.url = reference;
    media.pathname = item.plannedKey;
    block.src = reference;
    substitutions += 1;
  });
  if (!walked) return null;
  return { document, substitutions };
}

function r2Inventory(doc: unknown, plannedKeys: Set<string>): { legacy: number; r2: number; other: number; srcMismatch: number } | null {
  let legacy = 0;
  let r2 = 0;
  let other = 0;
  let srcMismatch = 0;
  const seen = new Set<string>();
  const walked = walkBlocks(doc, (block) => {
    if (block.media == null) return;
    if (!block.media || typeof block.media !== "object" || Array.isArray(block.media)) {
      other += 1;
      return;
    }
    const media = block.media as Record<string, unknown>;
    const url = typeof media.url === "string" ? media.url : "";
    const pathname = typeof media.pathname === "string" ? media.pathname : "";
    const storage = storageOf(url, pathname);
    if (block.src !== url) srcMismatch += 1;
    if (storage === "blob") legacy += 1;
    else if (storage === "r2" && plannedKeys.has(pathname) && url === `r2:${pathname}`) {
      r2 += 1;
      seen.add(pathname);
    } else other += 1;
  });
  if (!walked) return null;
  if (seen.size !== r2) other += 1;
  return { legacy, r2, other, srcMismatch };
}

function transformedOk(doc: unknown, plannedKeys: Set<string>): boolean {
  const counts = r2Inventory(doc, plannedKeys);
  if (!counts) return false;
  if (counts.legacy !== 0 || counts.other !== 0 || counts.srcMismatch !== 0 || counts.r2 !== 14) return false;
  const parsed = validatePortfolioDocument(doc);
  return parsed.ok && !documentHasUnpersistedMedia(parsed.document);
}

export async function runPortfolioR2Cutover(body: unknown, deps: CutoverDeps): Promise<CutoverResponse> {
  try {
    await deps.requireAdmin();
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Acesso negado") return fail(403, "FORBIDDEN");
    return fail(401, "UNAUTHORIZED");
  }

  if (deps.vercelEnv !== "production") return fail(403, "NON_PRODUCTION");
  if (!parseCutoverRequest(body).ok) return fail(400, "INVALID_REQUEST");

  const manifest = deps.manifest ?? BLOB_TO_R2_MIGRATION_MANIFEST;
  const planKey = deps.planKey ?? planPortfolioR2ObjectKey;
  if (!manifestReady(manifest, planKey)) return fail(409, "MANIFEST_MISMATCH");

  const byPath = new Map(manifest.map((item) => [item.pathname, item]));
  const plannedKeys = new Set(manifest.map((item) => item.plannedKey));
  let success: CutoverResponse | null = null;

  try {
    await deps.transaction(async (tx) => {
      const row = await tx.read();
      if (
        !row ||
        row.id !== CUTOVER_ROW_ID ||
        row.draftVersion !== CUTOVER_EXPECTED_DRAFT_VERSION ||
        row.publishedVersion !== CUTOVER_EXPECTED_PUBLISHED_VERSION ||
        !sameInstant(row.draftUpdatedAt, CUTOVER_EXPECTED_DRAFT_UPDATED_AT) ||
        !sameInstant(row.publishedAt, CUTOVER_EXPECTED_PUBLISHED_AT)
      ) {
        throw new CutoverAbort(fail(409, "STATE_DRIFT"));
      }

      if (hasPreviewOnly(row.draftDocument) || hasPreviewOnly(row.publishedDocument)) {
        throw new CutoverAbort(fail(409, "STATE_DRIFT"));
      }
      if (!inventoryMatches(row.draftDocument, byPath, plannedKeys) || !inventoryMatches(row.publishedDocument, byPath, plannedKeys)) {
        throw new CutoverAbort(fail(409, "MEDIA_INVENTORY_MISMATCH"));
      }

      const draftParsed = validatePortfolioDocument(row.draftDocument);
      const publishedParsed = validatePortfolioDocument(row.publishedDocument);
      if (!draftParsed.ok || !publishedParsed.ok) throw new CutoverAbort(fail(409, "DOCUMENT_INVALID"));
      if (!samePortfolio(draftParsed.document, publishedParsed.document)) throw new CutoverAbort(fail(409, "STATE_DRIFT"));
      if (documentHasUnpersistedMedia(draftParsed.document) || documentHasUnpersistedMedia(publishedParsed.document)) {
        throw new CutoverAbort(fail(409, "STATE_DRIFT"));
      }

      const previousSnapshotSha256 = canonicalCutoverSnapshotSha256({
        draftDocument: row.draftDocument,
        publishedDocument: row.publishedDocument,
        draftVersion: row.draftVersion,
        publishedVersion: row.publishedVersion,
        draftUpdatedAt: CUTOVER_EXPECTED_DRAFT_UPDATED_AT.toISOString(),
        publishedAt: CUTOVER_EXPECTED_PUBLISHED_AT.toISOString(),
      });

      const draftNext = transformDocument(row.draftDocument, byPath);
      const publishedNext = transformDocument(row.publishedDocument, byPath);
      if (!draftNext || !publishedNext || draftNext.substitutions !== 14 || publishedNext.substitutions !== 14) {
        throw new CutoverAbort(fail(500, "INTERNAL_ERROR"));
      }
      if (!storagePreserved(row.draftDocument, draftNext.document) || !storagePreserved(row.publishedDocument, publishedNext.document)) {
        throw new CutoverAbort(fail(500, "INTERNAL_ERROR"));
      }
      if (!transformedOk(draftNext.document, plannedKeys) || !transformedOk(publishedNext.document, plannedKeys)) {
        throw new CutoverAbort(fail(500, "INTERNAL_ERROR"));
      }
      const draftReady = validatePortfolioDocument(draftNext.document);
      const publishedReady = validatePortfolioDocument(publishedNext.document);
      if (!draftReady.ok || !publishedReady.ok || !samePortfolio(draftReady.document, publishedReady.document)) {
        throw new CutoverAbort(fail(500, "INTERNAL_ERROR"));
      }

      const cutoverAt = (deps.now ?? (() => new Date()))();
      const written = await tx.updateMany({
        where: {
          id: CUTOVER_ROW_ID,
          draftVersion: CUTOVER_EXPECTED_DRAFT_VERSION,
          publishedVersion: CUTOVER_EXPECTED_PUBLISHED_VERSION,
          draftUpdatedAt: CUTOVER_EXPECTED_DRAFT_UPDATED_AT,
          publishedAt: CUTOVER_EXPECTED_PUBLISHED_AT,
        },
        data: {
          draftDocument: draftNext.document,
          publishedDocument: publishedNext.document,
          draftVersion: CUTOVER_NEXT_VERSION,
          publishedVersion: CUTOVER_NEXT_VERSION,
          draftUpdatedAt: cutoverAt,
          publishedAt: cutoverAt,
        },
      });
      if (written.count !== 1) throw new CutoverAbort(fail(409, "CONCURRENT_UPDATE"));

      const after = await tx.read();
      const afterDraft = after ? r2Inventory(after.draftDocument, plannedKeys) : null;
      const afterPublished = after ? r2Inventory(after.publishedDocument, plannedKeys) : null;
      const afterDraftParsed = after ? validatePortfolioDocument(after.draftDocument) : null;
      const afterPublishedParsed = after ? validatePortfolioDocument(after.publishedDocument) : null;
      if (
        !after ||
        after.id !== CUTOVER_ROW_ID ||
        after.draftVersion !== CUTOVER_NEXT_VERSION ||
        after.publishedVersion !== CUTOVER_NEXT_VERSION ||
        !sameInstant(after.draftUpdatedAt, cutoverAt) ||
        !sameInstant(after.publishedAt, cutoverAt) ||
        canonicalJson(after.draftDocument) !== canonicalJson(draftNext.document) ||
        canonicalJson(after.publishedDocument) !== canonicalJson(publishedNext.document) ||
        !afterDraft ||
        !afterPublished ||
        afterDraft.legacy !== 0 ||
        afterPublished.legacy !== 0 ||
        afterDraft.r2 !== 14 ||
        afterPublished.r2 !== 14 ||
        afterDraft.other !== 0 ||
        afterPublished.other !== 0 ||
        afterDraft.srcMismatch !== 0 ||
        afterPublished.srcMismatch !== 0 ||
        !afterDraftParsed?.ok ||
        !afterPublishedParsed?.ok ||
        !samePortfolio(afterDraftParsed.document, afterPublishedParsed.document)
      ) {
        throw new CutoverAbort(fail(500, "POST_WRITE_VERIFICATION_FAILED"));
      }

      success = {
        httpStatus: 200,
        body: {
          status: "CUTOVER_VERIFIED",
          oldDraftVersion: CUTOVER_EXPECTED_DRAFT_VERSION,
          newDraftVersion: CUTOVER_NEXT_VERSION,
          oldPublishedVersion: CUTOVER_EXPECTED_PUBLISHED_VERSION,
          newPublishedVersion: CUTOVER_NEXT_VERSION,
          oldDraftUpdatedAt: CUTOVER_EXPECTED_DRAFT_UPDATED_AT.toISOString(),
          newDraftUpdatedAt: cutoverAt.toISOString(),
          oldPublishedAt: CUTOVER_EXPECTED_PUBLISHED_AT.toISOString(),
          newPublishedAt: cutoverAt.toISOString(),
          draftSubstitutions: draftNext.substitutions,
          publishedSubstitutions: publishedNext.substitutions,
          draftLegacyRemaining: afterDraft.legacy,
          publishedLegacyRemaining: afterPublished.legacy,
          draftR2Present: afterDraft.r2,
          publishedR2Present: afterPublished.r2,
          documentsDiffer: !samePortfolio(afterDraftParsed.document, afterPublishedParsed.document),
          previousSnapshotSha256,
        },
      };
    });
  } catch (error) {
    if (error instanceof CutoverAbort) return error.response;
    return fail(500, "INTERNAL_ERROR");
  }

  return success ?? fail(500, "INTERNAL_ERROR");
}
