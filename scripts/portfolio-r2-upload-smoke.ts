/**
 * Smoke — upload novo do Portfólio no R2.
 * Sem rede, sem credencial real, sem Prisma.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  confirmPortfolioUpload,
  preparePortfolioUpload,
} from "../src/app/lib/storage/portfolio-r2-upload";
import {
  createPortfolioUploadTarget,
} from "../src/app/lib/storage/r2-portfolio";
import {
  portfolioWriteBucketAllowed,
  R2_PORTFOLIO_PREVIEW_BUCKET,
  R2_PORTFOLIO_PRODUCTION_BUCKET,
} from "../src/app/lib/storage/r2-config";
import {
  decidePortfolioUpload,
  parsePortfolioMedia,
  PORTFOLIO_MAX_BYTES,
  PORTFOLIO_UPLOAD_METADATA_KIND,
  proposePortfolioR2ObjectKey,
} from "../src/app/portfolio/portfolio-media-ref";
import type { R2Failure } from "../src/app/lib/storage/r2-delivery";
import type { PortfolioUploadTarget, R2PortfolioHeadSuccess } from "../src/app/lib/storage/r2-portfolio";

const UUID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const AUDIO_KEY = `portfolio/audio/${UUID}.wav`;
const BLOB_PATH = "portfolio/audio/1790837420900_abc123def456_track.wav";
const BLOB_URL = `https://store.blob.vercel-storage.com/${BLOB_PATH}`;
const ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_PORTFOLIO_BUCKET",
  "R2_DELIVERIES_BUCKET",
  "VERCEL_ENV",
] as const;

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function snapshot(): Record<string, string | undefined> {
  const saved: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) saved[key] = process.env[key];
  return saved;
}

function restore(saved: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
}

function fakeTarget(input: { objectKey: string; contentType: string }): Promise<({ ok: true } & PortfolioUploadTarget) | R2Failure> {
  return Promise.resolve({
    ok: true,
    url: "https://example.invalid/put",
    method: "PUT",
    headers: {
      "Content-Type": input.contentType,
      "x-amz-meta-kind": PORTFOLIO_UPLOAD_METADATA_KIND,
    },
    expiresIn: 900,
  });
}

function headOf(input: {
  size: number;
  contentType: string;
  metadataKind: string | null;
}): () => Promise<R2PortfolioHeadSuccess> {
  return async () => ({
    ok: true,
    size: input.size,
    contentType: input.contentType,
    metadataKind: input.metadataKind,
  });
}

async function main() {
  const saved = snapshot();
  try {
    const allowed = await preparePortfolioUpload(
      { kind: "audio", fileName: "mix-cliente.wav", size: 1024, contentType: "audio/wav", originalName: "mix-cliente.wav" },
      { createTarget: fakeTarget, randomUUID: () => UUID }
    );
    assert.equal(allowed.ok, true, "MIME/ext permitido deveria passar");
    if (!allowed.ok) throw new Error("prepare ok esperado");
    assert.equal(allowed.reference, `r2:${AUDIO_KEY}`);
    assert.equal(allowed.mimeType, "audio/wav");
    assert.equal(allowed.originalName, "mix-cliente.wav");
    assert.equal(allowed.size, 1024);
    assert.equal(allowed.upload.method, "PUT");
    assert.equal(allowed.upload.headers["Content-Type"], "audio/wav");
    must(!allowed.reference.includes("mix-cliente"), "originalName vazou para a ref");
    must(!allowed.upload.url.includes("mix-cliente"), "originalName vazou para a URL");
    const generated = proposePortfolioR2ObjectKey("audio", "mix-cliente.wav", UUID);
    assert.equal(generated, AUDIO_KEY);
    assert.equal(proposePortfolioR2ObjectKey("image", "capa.jpg", UUID), `portfolio/images/${UUID}.jpg`);
    assert.equal(proposePortfolioR2ObjectKey("video", "sessao.mp4", UUID), `portfolio/videos/${UUID}.mp4`);
    assert.equal(proposePortfolioR2ObjectKey("audio", "mix-cliente.wav", "not-a-uuid"), null);
    must(/^portfolio\/audio\/[0-9a-f-]{36}\.wav$/.test(AUDIO_KEY), "key fora do namespace/UUID");

    const parsed = parsePortfolioMedia(
      {
        url: allowed.reference,
        pathname: AUDIO_KEY,
        mimeType: "audio/wav",
        originalName: "mix-cliente.wav",
        size: 1024,
      },
      "audio"
    );
    assert.equal(parsed.ok, true, "parser deveria aceitar a ref R2 nova");

    const badExt = await preparePortfolioUpload(
      { kind: "audio", fileName: "track.exe", size: 1024, contentType: "audio/wav" },
      { createTarget: fakeTarget, randomUUID: () => UUID }
    );
    assert.equal(badExt.ok, false);
    if (!badExt.ok) assert.equal(badExt.code, "invalid_format");

    const badMime = await preparePortfolioUpload(
      { kind: "audio", fileName: "track.wav", size: 1024, contentType: "video/mp4" },
      { createTarget: fakeTarget, randomUUID: () => UUID }
    );
    assert.equal(badMime.ok, false);
    if (!badMime.ok) assert.equal(badMime.code, "invalid_format");

    const badKind = await preparePortfolioUpload(
      { kind: "image", fileName: "track.wav", size: 1024, contentType: "audio/wav" },
      { createTarget: fakeTarget, randomUUID: () => UUID }
    );
    assert.equal(badKind.ok, false);
    if (!badKind.ok) assert.equal(badKind.code, "invalid_format");

    const empty = await preparePortfolioUpload(
      { kind: "audio", fileName: "track.wav", size: 0, contentType: "audio/wav" },
      { createTarget: fakeTarget, randomUUID: () => UUID }
    );
    assert.equal(empty.ok, false);
    if (!empty.ok) assert.equal(empty.code, "invalid_format");

    const tooBig = await preparePortfolioUpload(
      { kind: "audio", fileName: "track.wav", size: PORTFOLIO_MAX_BYTES + 1, contentType: "audio/wav" },
      { createTarget: fakeTarget, randomUUID: () => UUID }
    );
    assert.equal(tooBig.ok, false);
    if (!tooBig.ok) assert.equal(tooBig.code, "too_large");

    const confirmed = await confirmPortfolioUpload(
      {
        reference: `r2:${AUDIO_KEY}`,
        originalName: "mix-cliente.wav",
        size: 1024,
        contentType: "audio/wav",
        kind: "audio",
      },
      { head: headOf({ size: 1024, contentType: "audio/wav", metadataKind: "portfolio" }) }
    );
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) throw new Error("confirm ok esperado");
    assert.equal(confirmed.media.url, `r2:${AUDIO_KEY}`);
    assert.equal(confirmed.media.pathname, AUDIO_KEY);
    assert.equal(confirmed.media.size, 1024);
    assert.equal(confirmed.media.mimeType, "audio/wav");
    assert.equal(confirmed.media.originalName, "mix-cliente.wav");

    const sizeMismatch = await confirmPortfolioUpload(
      {
        reference: `r2:${AUDIO_KEY}`,
        originalName: "mix-cliente.wav",
        size: 2048,
        contentType: "audio/wav",
      },
      { head: headOf({ size: 1024, contentType: "audio/wav", metadataKind: "portfolio" }) }
    );
    assert.equal(sizeMismatch.ok, false);
    if (!sizeMismatch.ok) assert.equal(sizeMismatch.code, "rejected");

    const mimeMismatch = await confirmPortfolioUpload(
      {
        reference: `r2:${AUDIO_KEY}`,
        originalName: "mix-cliente.wav",
        size: 1024,
        contentType: "audio/mpeg",
      },
      { head: headOf({ size: 1024, contentType: "audio/wav", metadataKind: "portfolio" }) }
    );
    assert.equal(mimeMismatch.ok, false);
    if (!mimeMismatch.ok) assert.equal(mimeMismatch.code, "rejected");

    const headMimeMismatch = await confirmPortfolioUpload(
      {
        reference: `r2:${AUDIO_KEY}`,
        originalName: "mix-cliente.wav",
        size: 1024,
        contentType: "audio/wav",
      },
      { head: headOf({ size: 1024, contentType: "audio/mpeg", metadataKind: "portfolio" }) }
    );
    assert.equal(headMimeMismatch.ok, false);
    if (!headMimeMismatch.ok) assert.equal(headMimeMismatch.code, "rejected");

    const badRef = await confirmPortfolioUpload(
      {
        reference: "r2:deliveries/not-portfolio.wav",
        originalName: "mix-cliente.wav",
        size: 1024,
        contentType: "audio/wav",
      },
      { head: headOf({ size: 1024, contentType: "audio/wav", metadataKind: "portfolio" }) }
    );
    assert.equal(badRef.ok, false);

    const traversal = await confirmPortfolioUpload(
      {
        reference: "r2:portfolio/audio/../secret.wav",
        originalName: "mix-cliente.wav",
        size: 1024,
        contentType: "audio/wav",
      },
      { head: headOf({ size: 1024, contentType: "audio/wav", metadataKind: "portfolio" }) }
    );
    assert.equal(traversal.ok, false);

    const blobStillOk = parsePortfolioMedia(
      {
        url: BLOB_URL,
        pathname: BLOB_PATH,
        mimeType: "audio/wav",
        originalName: "track.wav",
        size: 39356118,
      },
      "audio"
    );
    assert.equal(blobStillOk.ok, true, "ref Blob legado deve continuar válida");

    const visitor = decidePortfolioUpload({ action: "prepare", role: "visitor", configured: true });
    assert.equal(visitor.ok, false);
    if (!visitor.ok) assert.equal(visitor.status, 401);
    const user = decidePortfolioUpload({ action: "confirm", role: "user", configured: true });
    assert.equal(user.ok, false);
    if (!user.ok) assert.equal(user.status, 403);
    const missing = decidePortfolioUpload({ action: "prepare", role: "admin", configured: false });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.status, 503);
    const admin = decidePortfolioUpload({ action: "prepare", role: "admin", configured: true });
    assert.equal(admin.ok, true);

    assert.equal(portfolioWriteBucketAllowed(R2_PORTFOLIO_PRODUCTION_BUCKET, "production"), true);
    assert.equal(portfolioWriteBucketAllowed(R2_PORTFOLIO_PREVIEW_BUCKET, "production"), false);
    assert.equal(portfolioWriteBucketAllowed(R2_PORTFOLIO_PRODUCTION_BUCKET, "preview"), false);
    assert.equal(portfolioWriteBucketAllowed(R2_PORTFOLIO_PREVIEW_BUCKET, "preview"), true);
    assert.equal(portfolioWriteBucketAllowed(R2_PORTFOLIO_PRODUCTION_BUCKET, undefined), false);
    assert.equal(portfolioWriteBucketAllowed("test-portfolio-bucket", undefined), true);

    process.env.R2_ACCOUNT_ID = "localtest";
    process.env.R2_ACCESS_KEY_ID = "example-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "example-secret";
    process.env.R2_PORTFOLIO_BUCKET = R2_PORTFOLIO_PRODUCTION_BUCKET;
    process.env.VERCEL_ENV = "preview";
    const crossed = await createPortfolioUploadTarget({ objectKey: AUDIO_KEY, contentType: "audio/wav" });
    assert.equal(crossed.ok, false);
    if (!crossed.ok) {
      assert.equal(crossed.code, "unconfigured");
      must(!crossed.message.includes("R2_"), "mensagem citou variável");
      must(!crossed.message.includes(R2_PORTFOLIO_PRODUCTION_BUCKET), "mensagem citou bucket");
    }

    process.env.VERCEL_ENV = "production";
    process.env.R2_PORTFOLIO_BUCKET = R2_PORTFOLIO_PREVIEW_BUCKET;
    const crossedProd = await createPortfolioUploadTarget({ objectKey: AUDIO_KEY, contentType: "audio/wav" });
    assert.equal(crossedProd.ok, false);

    delete process.env.VERCEL_ENV;
    process.env.R2_PORTFOLIO_BUCKET = R2_PORTFOLIO_PRODUCTION_BUCKET;
    const localProd = await createPortfolioUploadTarget({ objectKey: AUDIO_KEY, contentType: "audio/wav" });
    assert.equal(localProd.ok, false, "local não deve escrever Production");

    process.env.R2_PORTFOLIO_BUCKET = "test-portfolio-bucket";
    const localOk = await createPortfolioUploadTarget({ objectKey: AUDIO_KEY, contentType: "audio/wav" });
    assert.equal(localOk.ok, true);
    if (localOk.ok) {
      must(localOk.url.includes("test-portfolio-bucket"), "presign fora do bucket configurado");
      must(!localOk.url.includes("thouse-portfolio"), "presign usou bucket Production");
      must(!localOk.url.includes("example-secret"), "segredo na URL");
      assert.equal(localOk.headers["Content-Type"], "audio/wav");
    }

    const root = process.cwd();
    const client = fs.readFileSync(path.join(root, "src/app/portfolio/portfolio-upload.ts"), "utf8");
    const route = fs.readFileSync(path.join(root, "src/app/api/admin/portfolio/upload/route.ts"), "utf8");
    const helper = fs.readFileSync(path.join(root, "src/app/lib/storage/portfolio-r2-upload.ts"), "utf8");
    const r2 = fs.readFileSync(path.join(root, "src/app/lib/storage/r2-portfolio.ts"), "utf8");
    const deliveryUpload = fs.readFileSync(path.join(root, "src/app/api/admin/servicos/upload-entrega/route.ts"), "utf8");
    const avatar = fs.readFileSync(path.join(root, "src/app/api/conta/avatar/route.ts"), "utf8");

    must(!client.includes("@vercel/blob/client"), "client ainda importa Blob");
    must(!route.includes("@vercel/blob/client"), "rota ainda importa Blob");
    must(!route.includes("PORTFOLIO_BLOB_READ_WRITE_TOKEN"), "upload novo usa token Blob");
    must(!helper.includes("PORTFOLIO_BLOB_READ_WRITE_TOKEN"), "helper usa token Blob");
    must(!helper.includes("DeleteObject"), "helper tem DELETE");
    must(!r2.includes("DeleteObjectCommand"), "r2-portfolio tem DELETE");
    must(!route.includes("prisma"), "upload escreve DB");
    must(!helper.includes("portfolioState"), "helper escreve PortfolioState");
    must(route.includes("requireAdmin()"), "rota sem requireAdmin");
    must(helper.includes("headPortfolioObject") || helper.includes("deps?.head"), "confirm sem HeadObject");
    must(deliveryUpload.includes("@vercel/blob") || deliveryUpload.includes("handleUpload"), "delivery saiu do próprio fluxo");
    must(avatar.includes("@vercel/blob"), "avatar saiu do Blob");
    must(!client.includes("upload-entrega"), "portfolio client acoplou delivery");
    must(!helper.includes("R2_DELIVERIES_BUCKET"), "portfolio upload leu bucket de entregas");
  } finally {
    restore(saved);
  }

  console.log("[portfolio-r2-upload-smoke] PASS");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "error";
  console.error("[portfolio-r2-upload-smoke] FAIL", message);
  process.exit(1);
});
