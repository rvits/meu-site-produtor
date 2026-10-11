/**
 * Smoke do cliente R2. Sem rede e sem credencial real.
 * Valores abaixo são fictícios e óbvios; não são configuração do projeto.
 */
import assert from "node:assert/strict";
import {
  R2_SIGNED_URL_TTL_SECONDS,
  R2_UPLOAD_URL_TTL_SECONDS,
  classifyR2SdkError,
  createDeliveryDownloadUrl,
  createDeliveryUploadTarget,
  headDeliveryObject,
  r2Failure,
} from "../src/app/lib/storage/r2-delivery";

const R2_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_DELIVERIES_BUCKET",
  "R2_PORTFOLIO_BUCKET",
  "R2_PORTFOLIO_PUBLIC_BASE_URL",
  "R2_ENDPOINT",
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

function clearR2() {
  for (const key of R2_KEYS) delete process.env[key];
}

function signedHeaderNames(url: string): string[] {
  const value = new URL(url).searchParams.get("X-Amz-SignedHeaders") || "";
  return value.split(";").filter(Boolean);
}

function queryEquals(url: string, name: string, expected: string): boolean {
  for (const [key, value] of new URL(url).searchParams.entries()) {
    if (key.toLowerCase() === name && value === expected) return true;
  }
  return false;
}

async function main() {
  const saved = snapshot();
  try {
    clearR2();

    const missingConfig = await headDeliveryObject("deliveries/file.wav");
    assert.equal(missingConfig.ok, false);
    if (!missingConfig.ok) {
      assert.equal(missingConfig.code, "unconfigured");
      must(!missingConfig.message.includes("R2_"), "mensagem citou variável");
      must(!/r2\.cloudflarestorage\.com/i.test(missingConfig.message), "mensagem citou endpoint");
    }

    const badKey = await createDeliveryUploadTarget({
      objectKey: "deliveries/../secret.wav",
      contentType: "audio/wav",
    });
    assert.equal(badKey.ok, false);
    if (!badKey.ok) assert.equal(badKey.code, "invalid_reference");

    const encoded = await headDeliveryObject("deliveries/%2e%2e/secret.wav");
    assert.equal(encoded.ok, false);
    if (!encoded.ok) assert.equal(encoded.code, "invalid_reference");

    process.env.R2_ACCOUNT_ID = "localtest";
    process.env.R2_ACCESS_KEY_ID = "example-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "example-secret";
    process.env.R2_DELIVERIES_BUCKET = "test-deliveries-bucket";

    const stillInvalid = await headDeliveryObject("portfolio/file.wav");
    assert.equal(stillInvalid.ok, false);
    if (!stillInvalid.ok) assert.equal(stillInvalid.code, "invalid_reference");

    const upload = await createDeliveryUploadTarget({
      objectKey: "deliveries/file.wav",
      contentType: "audio/wav",
      expiresIn: 999999,
      bucket: "other-bucket",
    } as { objectKey: string; contentType: string });
    assert.equal(upload.ok, true);
    if (upload.ok) {
      assert.equal(upload.method, "PUT");
      assert.equal(upload.headers["Content-Type"], "audio/wav");
      assert.equal(upload.headers["x-amz-meta-kind"], "delivery");
      assert.deepEqual(Object.keys(upload.headers).sort(), ["Content-Type", "x-amz-meta-kind"]);
      assert.equal(upload.expiresIn, R2_UPLOAD_URL_TTL_SECONDS);
      assert.equal(upload.expiresIn, 900);
      must(upload.url.startsWith("https://localtest.r2.cloudflarestorage.com/test-deliveries-bucket/"), "url fora do bucket de teste");
      must(upload.url.includes("X-Amz-Expires=900"), "ttl do PUT não é o do servidor");
      must(!upload.url.includes("X-Amz-Expires=120"), "PUT herdou o ttl de download");
      must(!upload.url.includes("X-Amz-Expires=999999"), "ttl veio do chamador");
      must(!upload.url.includes("example-secret"), "segredo apareceu na url");
      must(!upload.url.includes("other-bucket"), "bucket arbitrário foi aceito");
      must(!JSON.stringify(upload.headers).includes("example-secret"), "segredo apareceu no header");
      must(signedHeaderNames(upload.url).includes("content-type"), "content-type não entrou na assinatura");
      must(signedHeaderNames(upload.url).includes("host"), "host saiu da assinatura");
      must(signedHeaderNames(upload.url).includes("x-amz-meta-kind"), "metadata kind fora da assinatura");
      must(!queryEquals(upload.url, "x-amz-meta-kind", "delivery"), "metadata kind ficou só na query");
    }

    const cases = [
      ["deliveries/file.mp3", "audio/mpeg", "audio/mpeg"],
      ["deliveries/file.mp3", "audio/mp3", "audio/mpeg"],
      ["deliveries/file.wav", "audio/x-wav", "audio/wav"],
      ["deliveries/file.zip", "application/zip", "application/zip"],
      ["deliveries/file.zip", "application/x-zip-compressed", "application/zip"],
    ] as const;
    for (const [objectKey, contentType, expected] of cases) {
      const result = await createDeliveryUploadTarget({ objectKey, contentType });
      assert.equal(result.ok, true);
      if (result.ok) {
        assert.equal(result.method, "PUT");
        assert.equal(result.headers["Content-Type"], expected);
        assert.equal(result.headers["x-amz-meta-kind"], "delivery");
        must(result.url.length > 0, "url ausente");
        must(signedHeaderNames(result.url).includes("content-type"), "content-type não entrou na assinatura");
        must(signedHeaderNames(result.url).includes("x-amz-meta-kind"), "metadata kind fora da assinatura");
        must(!result.url.includes("example-secret"), "segredo apareceu na url");
      }
    }

    const fromExtension = await createDeliveryUploadTarget({ objectKey: "deliveries/file.mp3" });
    assert.equal(fromExtension.ok, true);
    if (fromExtension.ok) assert.equal(fromExtension.headers["Content-Type"], "audio/mpeg");

    const crossType = await createDeliveryUploadTarget({
      objectKey: "deliveries/file.wav",
      contentType: "audio/mpeg",
    });
    assert.equal(crossType.ok, false);
    if (!crossType.ok) assert.equal(crossType.code, "invalid_reference");

    const download = await createDeliveryDownloadUrl({
      objectKey: "deliveries/file.wav",
      responseContentType: "audio/wav",
      responseContentDisposition: "attachment",
      fileName: "../../etc/passwd\r\n.wav",
    });
    assert.equal(download.ok, true);
    if (download.ok) {
      assert.equal(download.expiresIn, R2_SIGNED_URL_TTL_SECONDS);
      assert.equal(download.expiresIn, 120);
      must(download.url.includes("X-Amz-Expires=120"), "ttl de download mudou");
      must(download.url.includes("response-content-type"), "content-type ausente");
      must(download.url.includes("response-content-disposition"), "content-disposition ausente");
      must(!download.url.includes("example-secret"), "segredo apareceu na url de download");
      must(!download.url.includes("../"), "filename não foi sanitizado");
      must(!download.url.includes("%0A") && !download.url.includes("%0D"), "quebra de linha no filename");
    }

    const badType = await createDeliveryUploadTarget({
      objectKey: "deliveries/file.wav",
      contentType: "application/octet-stream",
    });
    assert.equal(badType.ok, false);
    if (!badType.ok) assert.equal(badType.code, "invalid_reference");
  } finally {
    restore(saved);
  }

  const nasty = new Error("https://localtest.r2.cloudflarestorage.com/test-deliveries-bucket example-secret");
  nasty.name = "NotFound";
  assert.equal(classifyR2SdkError(nasty), "missing");
  const forbidden = new Error("AccessDenied example-secret");
  forbidden.name = "AccessDenied";
  assert.equal(classifyR2SdkError(forbidden), "forbidden");
  assert.equal(classifyR2SdkError(Object.assign(new Error("boom example-secret"), { $metadata: { httpStatusCode: 503 } })), "upstream");

  const safe = r2Failure("upstream");
  must(!safe.message.includes("example-secret"), "mensagem pública copiou o erro interno");
  must(!safe.message.includes("cloudflarestorage"), "mensagem pública citou endpoint");
  must(!safe.message.includes("test-deliveries-bucket"), "mensagem pública citou bucket");

  console.log("r2-delivery-smoke ok");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "error";
  console.error(message.includes("example-secret") ? error instanceof Error && error.name : message);
  process.exit(1);
});
