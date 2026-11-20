/**
 * PREPARE e CONFIRM de um upload novo do Portfólio no R2.
 * Os bytes não passam por aqui. O browser envia o arquivo direto.
 * Não atualiza PortfolioState. Não apaga Blob nem R2.
 */

import { randomUUID } from "node:crypto";
import {
  canonicalPortfolioUploadMime,
  checkPortfolioFile,
  classifyPortfolioStorageReference,
  isPortfolioOriginalName,
  parsePortfolioMedia,
  PORTFOLIO_FILE_TOO_LARGE,
  PORTFOLIO_MAX_BYTES,
  PORTFOLIO_STORAGE_UNAVAILABLE,
  PORTFOLIO_UPLOAD_METADATA_KIND,
  portfolioMediaKind,
  proposePortfolioR2ObjectKey,
  type PortfolioMediaRef,
} from "@/app/portfolio/portfolio-media-ref";
import {
  createPortfolioUploadTarget,
  headPortfolioObject,
  type PortfolioUploadTarget,
  type R2PortfolioHeadSuccess,
} from "./r2-portfolio";
import type { R2Failure } from "./r2-delivery";

if (typeof window !== "undefined") {
  throw new Error("portfolio-r2-upload só pode ser usado no servidor.");
}

export const PORTFOLIO_UPLOAD_MESSAGES = {
  invalid_format: "Formato de arquivo não suportado.",
  too_large: PORTFOLIO_FILE_TOO_LARGE,
  upload_failed: "Não foi possível enviar o arquivo. Tente novamente.",
  confirm_failed: "Não foi possível confirmar o arquivo enviado. Tente novamente.",
} as const;

export type PortfolioUploadCode = "invalid_format" | "too_large" | "unconfigured" | "rejected";

export type PortfolioUploadFailure = {
  ok: false;
  code: PortfolioUploadCode;
  error: string;
};

function failure(code: PortfolioUploadCode, error: string): PortfolioUploadFailure {
  return { ok: false, code, error };
}

function normalizeMime(raw: string): string {
  return String(raw || "").split(";")[0].trim().toLowerCase();
}

function storageFailure(result: R2Failure, stage: "prepare" | "confirm"): PortfolioUploadFailure {
  const fallback =
    stage === "confirm" ? PORTFOLIO_UPLOAD_MESSAGES.confirm_failed : PORTFOLIO_UPLOAD_MESSAGES.upload_failed;
  if (result.code === "invalid_reference") return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);
  if (result.code === "unconfigured") return failure("unconfigured", PORTFOLIO_STORAGE_UNAVAILABLE);
  console.error("[portfolio-upload]", stage, result.code);
  return failure("rejected", fallback);
}

export async function preparePortfolioUpload(
  input: {
    kind: unknown;
    fileName: unknown;
    size: unknown;
    contentType?: unknown;
    originalName?: unknown;
  },
  deps?: {
    objectKey?: string;
    createTarget?: typeof createPortfolioUploadTarget;
    randomUUID?: () => string;
  }
): Promise<
  | {
      ok: true;
      reference: string;
      mimeType: string;
      originalName: string;
      size: number;
      upload: PortfolioUploadTarget;
    }
  | PortfolioUploadFailure
> {
  const kind = portfolioMediaKind(input.kind as "image" | "audio" | "video");
  if (!kind) return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);
  if (typeof input.fileName !== "string") return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);
  if (typeof input.size !== "number" || !Number.isSafeInteger(input.size)) {
    return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);
  }
  const originalName = isPortfolioOriginalName(input.originalName) ? input.originalName : input.fileName;
  if (!isPortfolioOriginalName(originalName)) return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);
  const contentType = typeof input.contentType === "string" ? input.contentType : "";
  const problem = checkPortfolioFile({ name: input.fileName, type: contentType, size: input.size }, kind);
  if (problem === PORTFOLIO_FILE_TOO_LARGE) return failure("too_large", PORTFOLIO_FILE_TOO_LARGE);
  if (problem) return failure("invalid_format", problem);
  const mimeType = canonicalPortfolioUploadMime(kind, input.fileName);
  if (!mimeType) return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);

  const objectKey =
    deps?.objectKey || proposePortfolioR2ObjectKey(kind, input.fileName, (deps?.randomUUID ?? randomUUID)());
  if (!objectKey) return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);
  const classified = classifyPortfolioStorageReference(`r2:${objectKey}`, objectKey);
  if (classified.kind !== "r2" || classified.mediaKind !== kind) {
    return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);
  }

  const createTarget = deps?.createTarget ?? createPortfolioUploadTarget;
  const target = await createTarget({ objectKey, contentType: mimeType });
  if (!target.ok) return storageFailure(target, "prepare");
  if (target.headers["Content-Type"] !== mimeType) {
    return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);
  }
  if (target.headers["x-amz-meta-kind"] !== PORTFOLIO_UPLOAD_METADATA_KIND) {
    return failure("rejected", PORTFOLIO_UPLOAD_MESSAGES.upload_failed);
  }

  return {
    ok: true,
    reference: classified.url,
    mimeType,
    originalName,
    size: input.size,
    upload: {
      url: target.url,
      method: "PUT",
      headers: target.headers,
      expiresIn: target.expiresIn,
    },
  };
}

export async function confirmPortfolioUpload(
  input: {
    reference: unknown;
    originalName: unknown;
    size: unknown;
    contentType: unknown;
    kind?: unknown;
  },
  deps?: {
    head?: (objectKey: string) => Promise<R2PortfolioHeadSuccess | R2Failure>;
  }
): Promise<{ ok: true; media: PortfolioMediaRef } | PortfolioUploadFailure> {
  if (typeof input.reference !== "string") return failure("rejected", PORTFOLIO_UPLOAD_MESSAGES.confirm_failed);
  if (!isPortfolioOriginalName(input.originalName)) {
    return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);
  }
  if (typeof input.size !== "number" || !Number.isSafeInteger(input.size) || input.size <= 0) {
    return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);
  }
  if (input.size > PORTFOLIO_MAX_BYTES) return failure("too_large", PORTFOLIO_FILE_TOO_LARGE);
  if (typeof input.contentType !== "string") return failure("invalid_format", PORTFOLIO_UPLOAD_MESSAGES.invalid_format);

  const classified = classifyPortfolioStorageReference(input.reference);
  if (classified.kind !== "r2") return failure("rejected", PORTFOLIO_UPLOAD_MESSAGES.confirm_failed);
  const expectedKind = input.kind == null ? classified.mediaKind : portfolioMediaKind(input.kind as "image" | "audio" | "video");
  if (!expectedKind || classified.mediaKind !== expectedKind) {
    return failure("rejected", PORTFOLIO_UPLOAD_MESSAGES.confirm_failed);
  }
  const mimeType = normalizeMime(input.contentType);
  const canonical = canonicalPortfolioUploadMime(classified.mediaKind, classified.objectKey);
  if (!canonical || mimeType !== canonical) return failure("rejected", PORTFOLIO_UPLOAD_MESSAGES.confirm_failed);

  const head = deps?.head ?? headPortfolioObject;
  let headed: R2PortfolioHeadSuccess | R2Failure;
  try {
    headed = await head(classified.objectKey);
  } catch {
    console.error("[portfolio-upload] confirm head-threw");
    return failure("rejected", PORTFOLIO_UPLOAD_MESSAGES.confirm_failed);
  }
  if (!headed.ok) return storageFailure(headed, "confirm");
  if (headed.size !== input.size) {
    console.error("[portfolio-upload] confirm size-mismatch");
    return failure("rejected", PORTFOLIO_UPLOAD_MESSAGES.confirm_failed);
  }
  if (normalizeMime(headed.contentType || "") !== mimeType) {
    console.error("[portfolio-upload] confirm type-mismatch");
    return failure("rejected", PORTFOLIO_UPLOAD_MESSAGES.confirm_failed);
  }
  if (headed.metadataKind !== PORTFOLIO_UPLOAD_METADATA_KIND) {
    console.error("[portfolio-upload] confirm metadata-mismatch");
    return failure("rejected", PORTFOLIO_UPLOAD_MESSAGES.confirm_failed);
  }

  const parsed = parsePortfolioMedia(
    {
      url: classified.url,
      pathname: classified.pathname,
      mimeType,
      originalName: input.originalName,
      size: input.size,
    },
    classified.mediaKind
  );
  if (!parsed.ok || !parsed.media) return failure("rejected", PORTFOLIO_UPLOAD_MESSAGES.confirm_failed);
  return { ok: true, media: parsed.media };
}
