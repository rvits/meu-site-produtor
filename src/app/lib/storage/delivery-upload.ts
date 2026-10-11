/**
 * PREPARE e CONFIRM de uma entrega nova no R2.
 * Os bytes não passam por esta função. O browser envia o arquivo direto.
 * Se o PUT passar e o CONFIRM falhar, o objeto pode ficar órfão.
 * Não há listagem nem delete de prefixo nesta fase.
 */

import { randomUUID } from "node:crypto";
import {
  classifyDeliveryStorageReference,
  DELIVERY_CANONICAL_CONTENT_TYPE,
  DELIVERY_MAX_BYTES,
  type DeliveryAudioExtension,
} from "../delivery-access";
import {
  DELIVERY_COMMIT_PROOF_TTL_SECONDS,
  DELIVERY_UPLOAD_PROOF_TTL_SECONDS,
  issueDeliveryProof,
  verifyDeliveryProof,
} from "./delivery-upload-proof";
import {
  createDeliveryUploadTarget,
  DELIVERY_METADATA_KIND,
  headDeliveryObject,
  type DeliveryUploadTarget,
  type R2Failure,
  type R2HeadSuccess,
} from "./r2-delivery";

if (typeof window !== "undefined") {
  throw new Error("delivery-upload só pode ser usado no servidor.");
}

export const DELIVERY_UPLOAD_MESSAGES = {
  invalid_format: "Formato de arquivo não suportado.",
  too_large: "O arquivo excede o limite permitido.",
  upload_failed: "Não foi possível enviar o arquivo. Tente novamente.",
  confirm_failed: "Não foi possível confirmar o arquivo enviado. Tente novamente.",
} as const;

export type DeliveryUploadCode = "invalid_format" | "too_large" | "unconfigured" | "rejected";

export type DeliveryUploadFailure = {
  ok: false;
  code: DeliveryUploadCode;
  error: string;
};

export type DeliveryHead = (objectKey: string) => Promise<R2HeadSuccess | R2Failure>;

function failure(code: DeliveryUploadCode, error: string): DeliveryUploadFailure {
  return { ok: false, code, error };
}

function extensionFromFileName(fileName: string): DeliveryAudioExtension | null {
  const base = String(fileName || "").split(/[/\\]/).pop() || "";
  const match = /\.(wav|mp3|zip)$/i.exec(base);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  if (ext === "wav" || ext === "mp3" || ext === "zip") return ext;
  return null;
}

function storageFailure(result: R2Failure, stage: "prepare" | "confirm"): DeliveryUploadFailure {
  const fallback =
    stage === "confirm" ? DELIVERY_UPLOAD_MESSAGES.confirm_failed : DELIVERY_UPLOAD_MESSAGES.upload_failed;
  if (result.code === "invalid_reference") return failure("invalid_format", DELIVERY_UPLOAD_MESSAGES.invalid_format);
  if (result.code === "unconfigured") return failure("unconfigured", fallback);
  console.error("[delivery-upload]", stage, result.code);
  return failure("rejected", fallback);
}

export async function prepareDeliveryUpload(
  input: { fileName: string; size: number; contentType?: string },
  deps?: {
    nowMs?: number;
    objectKey?: string;
    createTarget?: typeof createDeliveryUploadTarget;
  }
): Promise<
  | { ok: true; reference: string; upload: DeliveryUploadTarget; uploadToken: string }
  | DeliveryUploadFailure
> {
  const extension = extensionFromFileName(input.fileName);
  if (!extension) return failure("invalid_format", DELIVERY_UPLOAD_MESSAGES.invalid_format);
  if (typeof input.size !== "number" || !Number.isSafeInteger(input.size) || input.size <= 0) {
    return failure("invalid_format", DELIVERY_UPLOAD_MESSAGES.invalid_format);
  }
  if (input.size > DELIVERY_MAX_BYTES) return failure("too_large", DELIVERY_UPLOAD_MESSAGES.too_large);

  const objectKey = deps?.objectKey || `deliveries/${randomUUID()}.${extension}`;
  const reference = `r2:${objectKey}`;
  const classified = classifyDeliveryStorageReference(reference);
  if (classified.kind !== "r2" || classified.extension !== extension) {
    return failure("invalid_format", DELIVERY_UPLOAD_MESSAGES.invalid_format);
  }

  const createTarget = deps?.createTarget ?? createDeliveryUploadTarget;
  const target = await createTarget({
    objectKey,
    contentType: input.contentType,
  });
  if (!target.ok) return storageFailure(target, "prepare");
  if (target.headers["Content-Type"] !== DELIVERY_CANONICAL_CONTENT_TYPE[extension]) {
    return failure("invalid_format", DELIVERY_UPLOAD_MESSAGES.invalid_format);
  }
  if (target.headers["x-amz-meta-kind"] !== DELIVERY_METADATA_KIND) {
    return failure("rejected", DELIVERY_UPLOAD_MESSAGES.upload_failed);
  }

  const nowMs = deps?.nowMs ?? Date.now();
  const proof = issueDeliveryProof({
    purpose: "delivery-upload",
    reference,
    size: input.size,
    contentType: target.headers["Content-Type"],
    exp: Math.floor(nowMs / 1000) + DELIVERY_UPLOAD_PROOF_TTL_SECONDS,
  });
  if (!proof.ok) {
    return failure(
      proof.code === "invalid" ? "invalid_format" : "unconfigured",
      proof.code === "invalid" ? DELIVERY_UPLOAD_MESSAGES.invalid_format : DELIVERY_UPLOAD_MESSAGES.upload_failed
    );
  }
  return { ok: true, reference, upload: target, uploadToken: proof.token };
}

export async function confirmDeliveryUpload(
  uploadToken: string,
  deps?: { nowMs?: number; head?: DeliveryHead }
): Promise<
  | {
      ok: true;
      deliveryAudioUrl: string;
      deliveryAudioFormat: DeliveryAudioExtension;
      commitToken: string;
    }
  | DeliveryUploadFailure
> {
  const nowMs = deps?.nowMs ?? Date.now();
  const verified = verifyDeliveryProof(uploadToken, "delivery-upload", nowMs);
  if (!verified.ok) {
    if (verified.code === "unconfigured") {
      return failure("unconfigured", DELIVERY_UPLOAD_MESSAGES.confirm_failed);
    }
    return failure("rejected", DELIVERY_UPLOAD_MESSAGES.confirm_failed);
  }
  const classified = classifyDeliveryStorageReference(verified.claims.reference);
  if (classified.kind !== "r2") return failure("rejected", DELIVERY_UPLOAD_MESSAGES.confirm_failed);
  if (verified.claims.contentType !== DELIVERY_CANONICAL_CONTENT_TYPE[classified.extension]) {
    return failure("rejected", DELIVERY_UPLOAD_MESSAGES.confirm_failed);
  }

  // Mismatch não grava referência e não apaga o objeto. Um PUT que já passou pode deixar órfão.
  const head = deps?.head ?? headDeliveryObject;
  let headed: R2HeadSuccess | R2Failure;
  try {
    headed = await head(classified.objectKey);
  } catch {
    console.error("[delivery-upload] confirm head-threw");
    return failure("rejected", DELIVERY_UPLOAD_MESSAGES.confirm_failed);
  }
  if (!headed.ok) return storageFailure(headed, "confirm");
  if (headed.size !== verified.claims.size) {
    console.error("[delivery-upload] confirm size-mismatch");
    return failure("rejected", DELIVERY_UPLOAD_MESSAGES.confirm_failed);
  }
  if (headed.contentType !== verified.claims.contentType) {
    console.error("[delivery-upload] confirm type-mismatch");
    return failure("rejected", DELIVERY_UPLOAD_MESSAGES.confirm_failed);
  }
  if (headed.metadataKind !== DELIVERY_METADATA_KIND) {
    console.error("[delivery-upload] confirm metadata-mismatch");
    return failure("rejected", DELIVERY_UPLOAD_MESSAGES.confirm_failed);
  }

  const commit = issueDeliveryProof({
    purpose: "delivery-commit",
    reference: verified.claims.reference,
    size: verified.claims.size,
    contentType: verified.claims.contentType,
    exp: Math.floor(nowMs / 1000) + DELIVERY_COMMIT_PROOF_TTL_SECONDS,
  });
  if (!commit.ok) {
    return failure(
      commit.code === "unconfigured" ? "unconfigured" : "rejected",
      DELIVERY_UPLOAD_MESSAGES.confirm_failed
    );
  }
  return {
    ok: true,
    deliveryAudioUrl: verified.claims.reference,
    deliveryAudioFormat: classified.extension,
    commitToken: commit.token,
  };
}
