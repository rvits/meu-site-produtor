/**
 * Cliente S3 compatível com Cloudflare R2. Nunca importar em componente de browser.
 */

import { S3Client } from "@aws-sdk/client-s3";
import type { R2DeliverySettings } from "./r2-config";

if (typeof window !== "undefined") {
  throw new Error("r2-client só pode ser usado no servidor.");
}

const silentLogger = {
  debug() {},
  info() {},
  warn() {},
  error() {},
};

export function createR2Client(settings: R2DeliverySettings): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: settings.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: settings.accessKeyId,
      secretAccessKey: settings.secretAccessKey,
    },
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    logger: silentLogger,
  });
}
