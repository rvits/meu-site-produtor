/**
 * Leitura privada e PUT presignado do bucket de Portfólio no R2.
 * Sem DELETE, sem Copy. A URL assinada não é persistida.
 */

import { GetObjectCommand, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  acceptedPortfolioR2ObjectKey,
  PORTFOLIO_UPLOAD_METADATA_KIND,
  portfolioCanonicalContentType,
} from "@/app/portfolio/portfolio-media-ref";
import { contentDispositionInline } from "../delivery-filename";
import { classifyR2SdkError, R2_SIGNED_URL_TTL_SECONDS, type R2Failure, type R2FailureCode } from "./r2-delivery";
import { createR2Client } from "./r2-client";
import { portfolioWriteBucketAllowed, readR2PortfolioSettings } from "./r2-config";

if (typeof window !== "undefined") {
  throw new Error("r2-portfolio só pode ser usado no servidor.");
}

const PUBLIC_MESSAGE: Record<R2FailureCode, string> = {
  unconfigured: "Armazenamento permanente de mídia não está configurado neste ambiente.",
  missing: "Arquivo não encontrado.",
  forbidden: "Arquivo temporariamente indisponível. Tente novamente mais tarde.",
  upstream: "Arquivo temporariamente indisponível. Tente novamente mais tarde.",
  invalid_reference: "Caminho de mídia inválido.",
};

export function r2PortfolioFailure(code: R2FailureCode): R2Failure {
  return { ok: false, code, message: PUBLIC_MESSAGE[code] };
}

function rejectKey(objectKey: string): R2Failure | null {
  if (!acceptedPortfolioR2ObjectKey(objectKey)) return r2PortfolioFailure("invalid_reference");
  return null;
}

/** PUT direto do browser. 80 MiB não cabe em 120 s numa conexão lenta. */
export const PORTFOLIO_UPLOAD_URL_TTL_SECONDS = 15 * 60;

export type R2PortfolioHeadSuccess = {
  ok: true;
  size: number | null;
  contentType: string | null;
  metadataKind: string | null;
};

export type PortfolioUploadTarget = {
  url: string;
  method: "PUT";
  headers: {
    "Content-Type": string;
    "x-amz-meta-kind": typeof PORTFOLIO_UPLOAD_METADATA_KIND;
  };
  expiresIn: number;
};

function readMetadataKind(metadata: Record<string, string> | undefined): string | null {
  if (!metadata) return null;
  for (const [key, value] of Object.entries(metadata)) {
    if (key.toLowerCase() === "kind") return value;
  }
  return null;
}

export async function headPortfolioObject(objectKey: string): Promise<R2PortfolioHeadSuccess | R2Failure> {
  const invalid = rejectKey(objectKey);
  if (invalid) return invalid;
  const config = readR2PortfolioSettings();
  if (!config.ok) return r2PortfolioFailure("unconfigured");
  try {
    const client = createR2Client(config.settings);
    const result = await client.send(
      new HeadObjectCommand({
        Bucket: config.settings.portfolioBucket,
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
    return r2PortfolioFailure(classifyR2SdkError(error));
  }
}

export async function createPortfolioUploadTarget(input: {
  objectKey: string;
  contentType: string;
}): Promise<({ ok: true } & PortfolioUploadTarget) | R2Failure> {
  const invalid = rejectKey(input.objectKey);
  if (invalid) return invalid;
  const canonical = portfolioCanonicalContentType(input.objectKey);
  if (!canonical || canonical !== input.contentType) return r2PortfolioFailure("invalid_reference");
  const config = readR2PortfolioSettings();
  if (!config.ok) return r2PortfolioFailure("unconfigured");
  if (!portfolioWriteBucketAllowed(config.settings.portfolioBucket)) {
    return r2PortfolioFailure("unconfigured");
  }
  try {
    const client = createR2Client(config.settings);
    const command = new PutObjectCommand({
      Bucket: config.settings.portfolioBucket,
      Key: input.objectKey,
      ContentType: canonical,
      Metadata: { kind: PORTFOLIO_UPLOAD_METADATA_KIND },
    });
    const url = await getSignedUrl(client, command, {
      expiresIn: PORTFOLIO_UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(["content-type"]),
      unhoistableHeaders: new Set(["x-amz-meta-kind"]),
    });
    return {
      ok: true,
      url,
      method: "PUT",
      headers: {
        "Content-Type": canonical,
        "x-amz-meta-kind": PORTFOLIO_UPLOAD_METADATA_KIND,
      },
      expiresIn: PORTFOLIO_UPLOAD_URL_TTL_SECONDS,
    };
  } catch (error) {
    return r2PortfolioFailure(classifyR2SdkError(error));
  }
}

export async function createPortfolioReadUrl(input: {
  objectKey: string;
  fileName?: string;
}): Promise<{ ok: true; url: string; expiresIn: number } | R2Failure> {
  const invalid = rejectKey(input.objectKey);
  if (invalid) return invalid;
  const contentType = portfolioCanonicalContentType(input.objectKey);
  if (!contentType) return r2PortfolioFailure("invalid_reference");
  const config = readR2PortfolioSettings();
  if (!config.ok) return r2PortfolioFailure("unconfigured");
  const accepted = acceptedPortfolioR2ObjectKey(input.objectKey);
  const fileName = input.fileName || accepted?.file || "media";
  try {
    const client = createR2Client(config.settings);
    const command = new GetObjectCommand({
      Bucket: config.settings.portfolioBucket,
      Key: input.objectKey,
      ResponseContentType: contentType,
      ResponseContentDisposition: contentDispositionInline(fileName),
    });
    const url = await getSignedUrl(client, command, { expiresIn: R2_SIGNED_URL_TTL_SECONDS });
    return { ok: true, url, expiresIn: R2_SIGNED_URL_TTL_SECONDS };
  } catch (error) {
    return r2PortfolioFailure(classifyR2SdkError(error));
  }
}
