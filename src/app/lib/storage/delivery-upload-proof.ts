/**
 * Vínculo stateless entre PREPARE, CONFIRM e PATCH.
 * O segredo é server-only e não é a credencial do R2.
 * A URL assinada nunca entra no token.
 */

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  classifyDeliveryStorageReference,
  DELIVERY_CANONICAL_CONTENT_TYPE,
  DELIVERY_MAX_BYTES,
} from "../delivery-access";

if (typeof window !== "undefined") {
  throw new Error("delivery-upload-proof só pode ser usado no servidor.");
}

/** Cobre o PUT de 15 min e ainda deixa o CONFIRM acontecer depois. */
export const DELIVERY_UPLOAD_PROOF_TTL_SECONDS = 20 * 60;
export const DELIVERY_COMMIT_PROOF_TTL_SECONDS = 30 * 60;

const CONFIRM_ERROR = "Não foi possível confirmar o arquivo enviado. Tente novamente.";
const UNAVAILABLE =
  "Arquivo temporariamente indisponível. Tente novamente mais tarde.";

export type DeliveryProofPurpose = "delivery-upload" | "delivery-commit";

export type DeliveryProofClaims = {
  v: 1;
  purpose: DeliveryProofPurpose;
  reference: string;
  size: number;
  contentType: string;
  originalName: string;
  exp: number;
  nonce: string;
};

export type DeliveryProofFailure = { ok: false; code: "invalid" | "expired" | "unconfigured" };

function proofSecret(): Buffer | null {
  const raw = String(process.env.DELIVERY_UPLOAD_PROOF_SECRET ?? "").trim();
  const bytes = Buffer.byteLength(raw);
  if (bytes < 32 || bytes > 256) return null;
  if (/[\r\n\0]/.test(raw)) return null;
  return Buffer.from(raw, "utf8");
}

function signPayload(payload: string, key: Buffer): string {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

const CLAIM_KEYS = ["v", "purpose", "reference", "size", "contentType", "originalName", "exp", "nonce"] as const;

function isClaims(value: unknown): value is DeliveryProofClaims {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== CLAIM_KEYS.length || CLAIM_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(record, key))) {
    return false;
  }
  if (record.v !== 1) return false;
  if (record.purpose !== "delivery-upload" && record.purpose !== "delivery-commit") return false;
  if (typeof record.reference !== "string" || record.reference.length > 512) return false;
  if (!Number.isSafeInteger(record.size) || (record.size as number) <= 0 || (record.size as number) > DELIVERY_MAX_BYTES) {
    return false;
  }
  if (typeof record.contentType !== "string") return false;
  if (typeof record.originalName !== "string") return false;
  if (record.originalName.length < 1 || record.originalName.length > 120) return false;
  if (/[\u0000-\u001F\u007F\u2028\u2029]/.test(record.originalName)) return false;
  if (
    record.originalName.includes("/") ||
    record.originalName.includes("\\") ||
    record.originalName.includes("..")
  ) {
    return false;
  }
  if (!Number.isSafeInteger(record.exp)) return false;
  if (typeof record.nonce !== "string" || record.nonce.length < 16 || record.nonce.length > 64) return false;
  const classified = classifyDeliveryStorageReference(record.reference);
  if (classified.kind !== "r2") return false;
  if (record.contentType !== DELIVERY_CANONICAL_CONTENT_TYPE[classified.extension]) return false;
  return true;
}

export function issueDeliveryProof(
  claims: Omit<DeliveryProofClaims, "v" | "nonce"> & { nonce?: string }
): { ok: true; token: string } | { ok: false; code: "unconfigured" | "invalid" } {
  const key = proofSecret();
  if (!key) return { ok: false, code: "unconfigured" };
  const full: DeliveryProofClaims = {
    v: 1,
    purpose: claims.purpose,
    reference: claims.reference,
    size: claims.size,
    contentType: claims.contentType,
    originalName: claims.originalName,
    exp: claims.exp,
    nonce: claims.nonce || randomBytes(16).toString("hex"),
  };
  if (!isClaims(full)) return { ok: false, code: "invalid" };
  const payload = JSON.stringify(full);
  return { ok: true, token: `v1.${Buffer.from(payload).toString("base64url")}.${signPayload(payload, key)}` };
}

export function verifyDeliveryProof(
  token: string,
  expectedPurpose: DeliveryProofPurpose,
  nowMs = Date.now()
): ({ ok: true } & { claims: DeliveryProofClaims }) | DeliveryProofFailure {
  try {
    const key = proofSecret();
    if (!key) return { ok: false, code: "unconfigured" };
    if (typeof token !== "string" || token.length > 4000) return { ok: false, code: "invalid" };
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "v1" || !parts[1] || !parts[2]) return { ok: false, code: "invalid" };
    const payload = Buffer.from(parts[1], "base64url").toString("utf8");
    const expected = signPayload(payload, key);
    const given = Buffer.from(parts[2]);
    const actual = Buffer.from(expected);
    if (given.length !== actual.length || !timingSafeEqual(given, actual)) return { ok: false, code: "invalid" };
    const parsed: unknown = JSON.parse(payload);
    if (!isClaims(parsed) || parsed.purpose !== expectedPurpose) return { ok: false, code: "invalid" };
    if (parsed.exp * 1000 <= nowMs) return { ok: false, code: "expired" };
    return { ok: true, claims: parsed };
  } catch {
    return { ok: false, code: "invalid" };
  }
}

/**
 * Referência R2 só pode ser gravada com prova emitida depois do HeadObject.
 * Blob e path local não passam por este segredo.
 */
export function assertDeliveryCommitProof(
  reference: string | null | undefined,
  token: string | null | undefined,
  clientOriginalName?: string | null,
  nowMs = Date.now()
):
  | { ok: true; originalName: string | null }
  | { ok: false; error: string; httpStatus: 400 | 503; code: "invalid" | "unconfigured" } {
  const url = String(reference ?? "").trim();
  if (!url) return { ok: true, originalName: null };
  const classified = classifyDeliveryStorageReference(url);
  if (classified.kind !== "r2") {
    if (String(clientOriginalName || "").trim()) {
      return { ok: false, error: CONFIRM_ERROR, httpStatus: 400, code: "invalid" };
    }
    return { ok: true, originalName: null };
  }
  const verified = verifyDeliveryProof(String(token ?? ""), "delivery-commit", nowMs);
  if (!verified.ok) {
    if (verified.code === "unconfigured") {
      return { ok: false, error: UNAVAILABLE, httpStatus: 503, code: "unconfigured" };
    }
    return { ok: false, error: CONFIRM_ERROR, httpStatus: 400, code: "invalid" };
  }
  if (verified.claims.reference !== url) {
    return { ok: false, error: CONFIRM_ERROR, httpStatus: 400, code: "invalid" };
  }
  if (verified.claims.contentType !== DELIVERY_CANONICAL_CONTENT_TYPE[classified.extension]) {
    return { ok: false, error: CONFIRM_ERROR, httpStatus: 400, code: "invalid" };
  }
  if (verified.claims.size <= 0) {
    return { ok: false, error: CONFIRM_ERROR, httpStatus: 400, code: "invalid" };
  }
  const supplied = clientOriginalName == null ? "" : String(clientOriginalName).trim();
  if (supplied && supplied !== verified.claims.originalName) {
    return { ok: false, error: CONFIRM_ERROR, httpStatus: 400, code: "invalid" };
  }
  return { ok: true, originalName: verified.claims.originalName };
}
