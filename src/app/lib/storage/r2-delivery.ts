/**
 * Primitives de entrega no bucket privado. Bucket e TTL nascem no servidor.
 * A URL assinada não é persistida.
 */

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  acceptedDeliveryObjectKey,
  DELIVERY_CANONICAL_CONTENT_TYPE,
  type DeliveryAudioExtension,
} from "../delivery-access";
import { createR2Client } from "./r2-client";
import { readR2DeliverySettings } from "./r2-config";

if (typeof window !== "undefined") {
  throw new Error("r2-delivery só pode ser usado no servidor.");
}

/** Vida da URL de download. O chamador não escolhe este valor. */
export const R2_SIGNED_URL_TTL_SECONDS = 120;

/** PUT direto do browser. 80 MB não cabe em 120 s numa conexão lenta. */
export const R2_UPLOAD_URL_TTL_SECONDS = 15 * 60;

const ACCEPTED_CONTENT_TYPES: Record<DeliveryAudioExtension, ReadonlySet<string>> = {
  wav: new Set(["audio/wav", "audio/x-wav"]),
  mp3: new Set(["audio/mpeg", "audio/mp3"]),
  zip: new Set(["application/zip", "application/x-zip-compressed"]),
};

const CONTENT_TYPES = new Set(
  Object.values(ACCEPTED_CONTENT_TYPES).flatMap((types) => [...types])
);

export const DELIVERY_METADATA_KIND = "delivery";

export type R2FailureCode = "unconfigured" | "missing" | "forbidden" | "upstream" | "invalid_reference";

export type R2Failure = { ok: false; code: R2FailureCode; message: string };

export type R2HeadSuccess = {
  ok: true;
  size: number | null;
  contentType: string | null;
  metadataKind: string | null;
};

export type DeliveryUploadTarget = {
  url: string;
  method: "PUT";
  headers: {
    "Content-Type": string;
    "x-amz-meta-kind": typeof DELIVERY_METADATA_KIND;
  };
  expiresIn: number;
};

const PUBLIC_MESSAGE: Record<R2FailureCode, string> = {
  unconfigured: "Armazenamento de entrega não configurado.",
  missing: "Arquivo não encontrado.",
  forbidden: "Arquivo temporariamente indisponível. Tente novamente mais tarde.",
  upstream: "Arquivo temporariamente indisponível. Tente novamente mais tarde.",
  invalid_reference: "Faça upload do arquivo (WAV/MP3/ZIP). Caminho inválido.",
};

export function r2Failure(code: R2FailureCode): R2Failure {
  return { ok: false, code, message: PUBLIC_MESSAGE[code] };
}

export function classifyR2SdkError(error: unknown): Exclude<R2FailureCode, "unconfigured" | "invalid_reference"> {
  const name = error instanceof Error ? error.name : "";
  const status =
    error && typeof error === "object" && "$metadata" in error
      ? Number((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode || 0)
      : 0;
  if (name === "NotFound" || name === "NoSuchKey" || status === 404 || status === 410) return "missing";
  if (name === "AccessDenied" || name === "Forbidden" || status === 401 || status === 403) return "forbidden";
  return "upstream";
}

function rejectKey(objectKey: string): R2Failure | null {
  if (!acceptedDeliveryObjectKey(objectKey)) return r2Failure("invalid_reference");
  return null;
}

function readMetadataKind(metadata: Record<string, string> | undefined): string | null {
  if (!metadata) return null;
  for (const [key, value] of Object.entries(metadata)) {
    if (key.toLowerCase() === "kind") return value;
  }
  return null;
}

/**
 * A extensão da key decide o MIME gravado. Um MIME informado só passa se for
 * um alias aceito dessa extensão; o valor emitido é sempre o canônico.
 */
function canonicalUploadContentType(objectKey: string, requested: string | undefined): string | null {
  const extension = acceptedDeliveryObjectKey(objectKey);
  if (!extension) return null;
  if (requested == null) return DELIVERY_CANONICAL_CONTENT_TYPE[extension];
  const contentType = requested.split(";")[0].trim().toLowerCase();
  if (!ACCEPTED_CONTENT_TYPES[extension].has(contentType)) return null;
  return DELIVERY_CANONICAL_CONTENT_TYPE[extension];
}

function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || "entrega";
  const cleaned = base.replace(/[\r\n"\\]/g, "").replace(/[^\w.\- ]+/g, "_").slice(0, 180);
  return cleaned || "entrega";
}

export async function headDeliveryObject(objectKey: string): Promise<R2HeadSuccess | R2Failure> {
  const invalid = rejectKey(objectKey);
  if (invalid) return invalid;
  const config = readR2DeliverySettings();
  if (!config.ok) return r2Failure("unconfigured");
  try {
    const client = createR2Client(config.settings);
    const result = await client.send(
      new HeadObjectCommand({
        Bucket: config.settings.deliveriesBucket,
        Key: objectKey,
      })
    );
    return {
      ok: true,
      size: typeof result.ContentLength === "number" ? result.ContentLength : null,
      contentType: result.ContentType || null,
      metadataKind: readMetadataKind(result.Metadata),
    };
  } catch (error) {
    return r2Failure(classifyR2SdkError(error));
  }
}

export async function createDeliveryUploadTarget(input: {
  objectKey: string;
  contentType?: string;
}): Promise<({ ok: true } & DeliveryUploadTarget) | R2Failure> {
  const invalid = rejectKey(input.objectKey);
  if (invalid) return invalid;
  const contentType = canonicalUploadContentType(input.objectKey, input.contentType);
  if (!contentType) return r2Failure("invalid_reference");
  const config = readR2DeliverySettings();
  if (!config.ok) return r2Failure("unconfigured");
  try {
    const client = createR2Client(config.settings);
    const command = new PutObjectCommand({
      Bucket: config.settings.deliveriesBucket,
      Key: input.objectKey,
      ContentType: contentType,
      Metadata: { kind: DELIVERY_METADATA_KIND },
    });
    // content-type é unsignable no presigner S3; signableHeaders devolve o MIME à assinatura.
    // x-amz-meta-* iria para a query, e o R2 não grava metadata recebida só assim.
    const url = await getSignedUrl(client, command, {
      expiresIn: R2_UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(["content-type"]),
      unhoistableHeaders: new Set(["x-amz-meta-kind"]),
    });
    return {
      ok: true,
      url,
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "x-amz-meta-kind": DELIVERY_METADATA_KIND,
      },
      expiresIn: R2_UPLOAD_URL_TTL_SECONDS,
    };
  } catch (error) {
    return r2Failure(classifyR2SdkError(error));
  }
}

export async function createDeliveryDownloadUrl(input: {
  objectKey: string;
  responseContentType?: string;
  responseContentDisposition?: "inline" | "attachment";
  fileName?: string;
}): Promise<{ ok: true; url: string; expiresIn: number } | R2Failure> {
  const invalid = rejectKey(input.objectKey);
  if (invalid) return invalid;
  let responseContentType: string | undefined;
  if (input.responseContentType) {
    responseContentType = input.responseContentType.split(";")[0].trim().toLowerCase();
    if (!CONTENT_TYPES.has(responseContentType)) return r2Failure("invalid_reference");
  }
  if (
    input.responseContentDisposition &&
    input.responseContentDisposition !== "inline" &&
    input.responseContentDisposition !== "attachment"
  ) {
    return r2Failure("invalid_reference");
  }
  const config = readR2DeliverySettings();
  if (!config.ok) return r2Failure("unconfigured");
  try {
    const client = createR2Client(config.settings);
    const command = new GetObjectCommand({
      Bucket: config.settings.deliveriesBucket,
      Key: input.objectKey,
      ResponseContentType: responseContentType,
      ResponseContentDisposition: input.responseContentDisposition
        ? `${input.responseContentDisposition}; filename="${safeFileName(input.fileName || "entrega")}"`
        : undefined,
    });
    const url = await getSignedUrl(client, command, { expiresIn: R2_SIGNED_URL_TTL_SECONDS });
    return { ok: true, url, expiresIn: R2_SIGNED_URL_TTL_SECONDS };
  } catch (error) {
    return r2Failure(classifyR2SdkError(error));
  }
}
