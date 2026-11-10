/**
 * Leitura privada do bucket de Portfólio no R2.
 * Sem PUT, sem DELETE, sem Copy. A URL assinada não é persistida.
 */

import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  acceptedPortfolioR2ObjectKey,
  portfolioCanonicalContentType,
} from "@/app/portfolio/portfolio-media-ref";
import { contentDispositionInline } from "../delivery-filename";
import { classifyR2SdkError, R2_SIGNED_URL_TTL_SECONDS, type R2Failure, type R2FailureCode } from "./r2-delivery";
import { createR2Client } from "./r2-client";
import { readR2PortfolioSettings } from "./r2-config";

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

export type R2PortfolioHeadSuccess = {
  ok: true;
  size: number | null;
  contentType: string | null;
};

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
