/**
 * Smoke — camada de compatibilidade Blob + R2 do Portfólio.
 * Sem rede, sem Prisma, sem credencial real, sem upload.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { classifyDeliveryStorageReference } from "../src/app/lib/delivery-access";
import {
  createPortfolioReadUrl,
  headPortfolioObject,
} from "../src/app/lib/storage/r2-portfolio";
import {
  acceptedPortfolioR2ObjectKey,
  buildPortfolioMediaObjectKey,
  classifyPortfolioStorageReference,
  parsePortfolioMedia,
  portfolioPlaybackUrl,
  type PortfolioMediaRef,
} from "../src/app/portfolio/portfolio-media-ref";

const UUID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const BLOB_PATH = "portfolio/audio/1790837420900_abc123def456_track.wav";
const BLOB_URL = `https://store.blob.vercel-storage.com/${BLOB_PATH}`;
const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_DELIVERIES_BUCKET",
  "R2_PORTFOLIO_BUCKET",
] as const;

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function snapshot(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of R2_KEYS) saved[key] = process.env[key];
  return saved;
}

function restore(saved: Record<string, string | undefined>) {
  for (const key of R2_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

function media(partial: Partial<PortfolioMediaRef> & Pick<PortfolioMediaRef, "url" | "pathname">): PortfolioMediaRef {
  return {
    mimeType: "audio/wav",
    originalName: "track.wav",
    size: 39636086,
    ...partial,
  };
}

function parseOk(value: unknown, kind: "image" | "audio" | "video") {
  const parsed = parsePortfolioMedia(value, kind);
  assert.equal(parsed.ok, true, `esperava ok para ${kind}`);
  if (!parsed.ok || !parsed.media) throw new Error("parse sem media");
  return parsed.media;
}

function parseFail(value: unknown, kind: "image" | "audio" | "video") {
  const parsed = parsePortfolioMedia(value, kind);
  assert.equal(parsed.ok, false, `esperava rejeição para ${kind}`);
}

async function main() {
  // A. legacy Blob reference accepted
  const blobRef = parseOk(
    media({
      url: BLOB_URL,
      pathname: BLOB_PATH,
      mimeType: "audio/wav",
      originalName: "mix-final.wav",
      size: 39636086,
    }),
    "audio"
  );
  assert.equal(classifyPortfolioStorageReference(blobRef.url, blobRef.pathname).kind, "blob");

  // L. Blob URL remains unchanged
  assert.equal(blobRef.url, BLOB_URL);
  assert.equal(portfolioPlaybackUrl(blobRef), BLOB_URL);

  // I/J/K. originalName, size, mime preserved (Blob)
  assert.equal(blobRef.originalName, "mix-final.wav");
  assert.equal(blobRef.size, 39636086);
  assert.equal(blobRef.mimeType, "audio/wav");

  const extraStorage = parseOk(
    { ...blobRef, storage: "r2", storageKey: "ignored" },
    "audio"
  );
  assert.equal(extraStorage.url, BLOB_URL);

  // B. canonical R2 image accepted
  const imageKey = `portfolio/images/${UUID}.jpg`;
  const imageRef = parseOk(
    {
      url: `r2:${imageKey}`,
      pathname: imageKey,
      mimeType: "image/jpeg",
      originalName: "capa.jpg",
      size: 210118,
    },
    "image"
  );
  assert.equal(classifyPortfolioStorageReference(imageRef.url, imageRef.pathname).kind, "r2");
  assert.equal(imageRef.originalName, "capa.jpg");
  assert.equal(imageRef.size, 210118);
  assert.equal(imageRef.mimeType, "image/jpeg");
  assert.equal(portfolioPlaybackUrl(imageRef), `/api/portfolio/media/images/${UUID}.jpg`);

  // C. canonical R2 audio accepted
  const audioKey = `portfolio/audio/${UUID}.wav`;
  const audioRef = parseOk(
    {
      url: `r2:${audioKey}`,
      pathname: audioKey,
      mimeType: "audio/wav",
      originalName: "beat.wav",
      size: 43576534,
    },
    "audio"
  );
  assert.equal(audioRef.pathname, audioKey);
  assert.equal(portfolioPlaybackUrl(audioRef), `/api/portfolio/media/audio/${UUID}.wav`);

  // D. canonical R2 video accepted
  const videoKey = `portfolio/videos/${UUID}.mp4`;
  const videoRef = parseOk(
    {
      url: `r2:${videoKey}`,
      pathname: videoKey,
      mimeType: "video/mp4",
      originalName: "sessao.mp4",
      size: 8493862,
    },
    "video"
  );
  assert.equal(portfolioPlaybackUrl(videoRef), `/api/portfolio/media/videos/${UUID}.mp4`);

  // E. arbitrary external HTTPS rejected
  parseFail(
    media({
      url: "https://cdn.example.com/portfolio/audio/track.wav",
      pathname: BLOB_PATH,
    }),
    "audio"
  );

  // F. malformed r2 reference rejected
  parseFail(
    media({
      url: `r2:portfolio/audio/${UUID}.wav?X-Amz-Signature=abc`,
      pathname: audioKey,
    }),
    "audio"
  );
  parseFail(
    media({
      url: `r2:portfolio/audio/not-a-uuid.wav`,
      pathname: "portfolio/audio/not-a-uuid.wav",
    }),
    "audio"
  );
  assert.equal(acceptedPortfolioR2ObjectKey(BLOB_PATH), null);

  // G. r2:deliveries/... rejected by Portfolio
  parseFail(
    media({
      url: `r2:deliveries/${UUID}.wav`,
      pathname: `deliveries/${UUID}.wav`,
    }),
    "audio"
  );
  assert.equal(
    classifyPortfolioStorageReference(`r2:deliveries/${UUID}.wav`).kind,
    "invalid"
  );

  // H. traversal rejected
  assert.equal(buildPortfolioMediaObjectKey("audio", "../secret.wav"), null);
  assert.equal(acceptedPortfolioR2ObjectKey("portfolio/audio/../secret.wav"), null);
  assert.equal(acceptedPortfolioR2ObjectKey("portfolio/audio/%2e%2e/secret.wav"), null);
  assert.equal(acceptedPortfolioR2ObjectKey(`portfolio/audio/${UUID}.wav/../x.wav`), null);
  parseFail(
    {
      url: "r2:portfolio/audio/../secret.wav",
      pathname: "portfolio/audio/../secret.wav",
      mimeType: "audio/wav",
      originalName: "secret.wav",
      size: 1024,
    },
    "audio"
  );

  // M. no signed URL persisted
  const playback = portfolioPlaybackUrl(audioRef);
  assert.ok(playback && playback.startsWith("/api/portfolio/media/"));
  must(!playback.includes("X-Amz-"), "playback expôs signed query");
  must(!playback.includes("r2.cloudflarestorage.com"), "playback expôs host R2");
  parseFail(
    media({
      url: `https://localtest.r2.cloudflarestorage.com/test-portfolio-bucket/${audioKey}?X-Amz-Signature=abc`,
      pathname: audioKey,
    }),
    "audio"
  );

  // N. current Portfolio upload path remains Blob
  const uploadClient = fs.readFileSync(path.join(process.cwd(), "src/app/portfolio/portfolio-upload.ts"), "utf8");
  const uploadRoute = fs.readFileSync(path.join(process.cwd(), "src/app/api/admin/portfolio/upload/route.ts"), "utf8");
  must(uploadClient.includes('@vercel/blob/client'), "upload client saiu do Blob");
  must(uploadClient.includes('handleUploadUrl: "/api/admin/portfolio/upload"'), "handleUploadUrl mudou");
  must(!uploadClient.includes("createPortfolioReadUrl"), "upload client passou a assinar R2");
  must(uploadRoute.includes("@vercel/blob/client"), "rota de upload saiu do Blob");
  must(uploadRoute.includes("PORTFOLIO_BLOB_READ_WRITE_TOKEN"), "token de Portfólio Blob ausente");
  must(!uploadRoute.includes("R2_PORTFOLIO_BUCKET"), "upload admin passou a usar bucket R2");

  // O. delivery storage classification unchanged
  const deliveryBlob = classifyDeliveryStorageReference(
    "https://example.public.blob.vercel-storage.com/deliveries/fixture-entrega.wav"
  );
  assert.equal(deliveryBlob.kind, "vercel_blob");
  const deliveryR2 = classifyDeliveryStorageReference(`r2:deliveries/${UUID}.wav`);
  assert.equal(deliveryR2.kind, "r2");
  const portfolioAsDelivery = classifyDeliveryStorageReference(`r2:${audioKey}`);
  assert.equal(portfolioAsDelivery.kind, "invalid");

  const saved = snapshot();
  try {
    for (const key of R2_KEYS) delete process.env[key];
    const unconfigured = await headPortfolioObject(audioKey);
    assert.equal(unconfigured.ok, false);
    if (!unconfigured.ok) {
      assert.equal(unconfigured.code, "unconfigured");
      must(!unconfigured.message.includes("R2_"), "mensagem citou variável");
    }

    process.env.R2_ACCOUNT_ID = "localtest";
    process.env.R2_ACCESS_KEY_ID = "example-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "example-secret";
    process.env.R2_DELIVERIES_BUCKET = "test-deliveries-bucket";
    process.env.R2_PORTFOLIO_BUCKET = "test-portfolio-bucket";

    const deliveryKey = await createPortfolioReadUrl({ objectKey: `deliveries/${UUID}.wav` });
    assert.equal(deliveryKey.ok, false);
    if (!deliveryKey.ok) assert.equal(deliveryKey.code, "invalid_reference");

    const signed = await createPortfolioReadUrl({ objectKey: audioKey });
    assert.equal(signed.ok, true);
    if (signed.ok) {
      assert.equal(signed.expiresIn, 120);
      must(signed.url.startsWith("https://localtest.r2.cloudflarestorage.com/test-portfolio-bucket/"), "url fora do bucket de portfólio");
      must(signed.url.includes("X-Amz-Expires=120"), "ttl de leitura mudou");
      must(!signed.url.includes("test-deliveries-bucket"), "leitura usou bucket de entregas");
      must(!signed.url.includes("example-secret"), "segredo apareceu na url");
      parseFail(
        media({
          url: signed.url,
          pathname: audioKey,
        }),
        "audio"
      );
    }
  } finally {
    restore(saved);
  }

  const r2PortfolioSrc = fs.readFileSync(path.join(process.cwd(), "src/app/lib/storage/r2-portfolio.ts"), "utf8");
  must(!r2PortfolioSrc.includes("PutObjectCommand"), "r2-portfolio expôs PUT");
  must(!r2PortfolioSrc.includes("DeleteObjectCommand"), "r2-portfolio expôs DELETE");
  must(!r2PortfolioSrc.includes("CopyObjectCommand"), "r2-portfolio expôs COPY");

  console.log("[portfolio-r2-compat-smoke] PASS");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "error";
  console.error("[portfolio-r2-compat-smoke] FAIL", message.includes("example-secret") ? error instanceof Error && error.name : message);
  process.exit(1);
});
