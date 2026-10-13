/**
 * Smoke da Fase 3. Sem rede e sem credencial real.
 * Valores abaixo são fictícios.
 */
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { DELIVERY_MAX_BYTES, classifyDeliveryStorageReference } from "../src/app/lib/delivery-access";
import { validateDeliveryFieldReplacement } from "../src/app/lib/delivery-storage";
import {
  confirmDeliveryUpload,
  prepareDeliveryUpload,
} from "../src/app/lib/storage/delivery-upload";
import {
  assertDeliveryCommitProof,
  DELIVERY_COMMIT_PROOF_TTL_SECONDS,
  DELIVERY_UPLOAD_PROOF_TTL_SECONDS,
  issueDeliveryProof,
  verifyDeliveryProof,
} from "../src/app/lib/storage/delivery-upload-proof";
import { r2Failure, type R2HeadSuccess } from "../src/app/lib/storage/r2-delivery";

const ENV_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_DELIVERIES_BUCKET",
  "DELIVERY_UPLOAD_PROOF_SECRET",
] as const;

function setProcessEnv(name: "NODE_ENV" | "VERCEL_ENV", value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[name];
  else env[name] = value;
}

const KEY_RE = /^r2:deliveries\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(mp3|wav|zip)$/;
const PROOF_TEST_SECRET = "delivery-proof-test-secret-not-real";

function signRaw(payload: string): string {
  const signature = createHmac("sha256", Buffer.from(PROOF_TEST_SECRET)).update(payload).digest("base64url");
  return `v1.${Buffer.from(payload).toString("base64url")}.${signature}`;
}

function replaceSignedField(token: string, from: string, to: string): string {
  const parts = token.split(".");
  const raw = Buffer.from(parts[1] || "", "base64url").toString("utf8").replace(from, to);
  return `${parts[0]}.${Buffer.from(raw).toString("base64url")}.${parts[2]}`;
}

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

function claimsOf(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] || "";
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}

function headOf(input: {
  size: number;
  contentType: string;
  metadataKind: string | null;
}): () => Promise<R2HeadSuccess> {
  return async () => ({
    ok: true,
    size: input.size,
    contentType: input.contentType,
    metadataKind: input.metadataKind,
  });
}

async function main() {
  const saved = snapshot();
  const savedNode = process.env.NODE_ENV;
  const savedVercel = process.env.VERCEL_ENV;
  try {
    delete process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCESS_KEY_ID;
    delete process.env.R2_SECRET_ACCESS_KEY;
    delete process.env.R2_DELIVERIES_BUCKET;
    delete process.env.DELIVERY_UPLOAD_PROOF_SECRET;

    const badName = await prepareDeliveryUpload({ fileName: "voz.exe", size: 20 });
    assert.equal(badName.ok, false);
    if (!badName.ok) {
      assert.equal(badName.code, "invalid_format");
      assert.equal(badName.error, "Formato de arquivo não suportado.");
    }

    const tooBig = await prepareDeliveryUpload({ fileName: "faixa.mp3", size: DELIVERY_MAX_BYTES + 1 });
    assert.equal(tooBig.ok, false);
    if (!tooBig.ok) {
      assert.equal(tooBig.code, "too_large");
      assert.equal(tooBig.error, "O arquivo excede o limite permitido.");
    }

    process.env.R2_ACCOUNT_ID = "localtest";
    process.env.R2_ACCESS_KEY_ID = "example-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "example-secret";
    process.env.R2_DELIVERIES_BUCKET = "test-deliveries-bucket";

    const missingSecret = await prepareDeliveryUpload({ fileName: "faixa.mp3", size: 27 });
    assert.equal(missingSecret.ok, false);
    if (!missingSecret.ok) {
      assert.equal(missingSecret.code, "unconfigured");
      assert.equal(missingSecret.error, "Não foi possível enviar o arquivo. Tente novamente.");
      must(!missingSecret.error.includes("SECRET"), "erro citou segredo");
      must(!missingSecret.error.includes("R2_"), "erro citou variável");
    }

    process.env.DELIVERY_UPLOAD_PROOF_SECRET = "x".repeat(31);
    const shortSecret = await prepareDeliveryUpload({ fileName: "faixa.mp3", size: 27 });
    assert.equal(shortSecret.ok, false);
    if (!shortSecret.ok) assert.equal(shortSecret.code, "unconfigured");

    process.env.DELIVERY_UPLOAD_PROOF_SECRET = PROOF_TEST_SECRET;
    assert.equal(DELIVERY_UPLOAD_PROOF_TTL_SECONDS, 20 * 60);
    assert.equal(DELIVERY_COMMIT_PROOF_TTL_SECONDS, 30 * 60);

    const cases = [
      ["voz-do-cliente.mp3", "audio/mpeg", "mp3"],
      ["gravacao.wav", "audio/wav", "wav"],
      ["pacote.zip", "application/zip", "zip"],
      ["alias.mp3", "audio/mpeg", "mp3"],
    ] as const;
    const mimeInput = ["audio/mpeg", "audio/wav", "application/zip", "audio/mp3"] as const;
    const references: string[] = [];

    for (let i = 0; i < cases.length; i++) {
      const [fileName, expectedMime, extension] = cases[i];
      const prepared = await prepareDeliveryUpload({
        fileName,
        size: 27,
        contentType: mimeInput[i],
      });
      assert.equal(prepared.ok, true);
      if (!prepared.ok) continue;
      references.push(prepared.reference);
      must(KEY_RE.test(prepared.reference), "key não é opaca");
      must(prepared.reference.endsWith(`.${extension}`), "extensão da key diverge");
      must(!prepared.reference.includes(fileName), "filename entrou na key");
      must(!prepared.reference.includes("http"), "referência parece URL");
      must(!prepared.reference.includes("X-Amz"), "referência contém assinatura");
      assert.equal(prepared.upload.method, "PUT");
      assert.equal(prepared.upload.headers["Content-Type"], expectedMime);
      assert.equal(prepared.upload.headers["x-amz-meta-kind"], "delivery");
      assert.equal(prepared.upload.expiresIn, 15 * 60);
      must(prepared.upload.url.length > 0, "url ausente");
      must(!prepared.upload.url.includes("example-secret"), "segredo na url");
      must(!prepared.reference.includes(prepared.upload.url), "url assinada foi persistida na referência");
      const payload = claimsOf(prepared.uploadToken);
      must(!("url" in payload), "token carrega url");
      must(!JSON.stringify(payload).includes("X-Amz"), "token carrega assinatura");
      must(!JSON.stringify(payload).includes("example-secret"), "token carrega segredo");
      assert.equal(payload.originalName, fileName);
      must(!prepared.reference.includes(String(payload.originalName)), "nome entrou na key");
    }
    must(new Set(references).size === references.length, "keys repetidas");

    const nowMs = Date.now();
    const mp3 = await prepareDeliveryUpload({ fileName: "faixa.mp3", size: 27 }, { nowMs });
    assert.equal(mp3.ok, true);
    if (!mp3.ok) return;

    const confirmed = await confirmDeliveryUpload(mp3.uploadToken, {
      nowMs,
      head: headOf({ size: 27, contentType: "audio/mpeg", metadataKind: "delivery" }),
    });
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    assert.equal(confirmed.deliveryAudioUrl, mp3.reference);
    assert.equal(confirmed.deliveryAudioFormat, "mp3");
    must(!confirmed.commitToken.includes("X-Amz"), "prova de commit carrega assinatura");
    must(!("url" in claimsOf(confirmed.commitToken)), "prova de commit carrega url");
    const attached = assertDeliveryCommitProof(confirmed.deliveryAudioUrl, confirmed.commitToken);
    assert.equal(attached.ok, true);
    if (attached.ok) assert.equal(attached.originalName, "faixa.mp3");
    const renamed = assertDeliveryCommitProof(confirmed.deliveryAudioUrl, confirmed.commitToken, "outro-nome.mp3");
    assert.equal(renamed.ok, false);
    const uploadClaims = claimsOf(mp3.uploadToken);
    const commitClaims = claimsOf(confirmed.commitToken);
    assert.equal(uploadClaims.purpose, "delivery-upload");
    assert.equal(commitClaims.purpose, "delivery-commit");
    assert.equal(uploadClaims.exp, Math.floor(nowMs / 1000) + DELIVERY_UPLOAD_PROOF_TTL_SECONDS);
    assert.equal(commitClaims.exp, Math.floor(nowMs / 1000) + DELIVERY_COMMIT_PROOF_TTL_SECONDS);
    must(!mp3.uploadToken.includes("example-secret"), "token carrega secret R2");
    must(!mp3.uploadToken.includes("example-access-key"), "token carrega access key");
    must(!confirmed.commitToken.includes("example-secret"), "commit carrega secret R2");
    must(!JSON.stringify(uploadClaims).includes("http"), "token carrega URL");
    must(!JSON.stringify(commitClaims).includes("cloudflare"), "token carrega endpoint");

    const uploadAsCommit = assertDeliveryCommitProof(mp3.reference, mp3.uploadToken);
    assert.equal(uploadAsCommit.ok, false);
    const commitAsUpload = await confirmDeliveryUpload(confirmed.commitToken, {
      head: headOf({ size: 27, contentType: "audio/mpeg", metadataKind: "delivery" }),
    });
    assert.equal(commitAsUpload.ok, false);
    if (!commitAsUpload.ok) {
      assert.equal(commitAsUpload.error, "Não foi possível confirmar o arquivo enviado. Tente novamente.");
      must(!commitAsUpload.error.includes("example-secret"), "erro de confirm citou segredo");
    }

    const flipped = verifyDeliveryProof(
      `${mp3.uploadToken.slice(0, -1)}${mp3.uploadToken.endsWith("a") ? "b" : "a"}`,
      "delivery-upload"
    );
    assert.equal(flipped.ok, false);
    if (!flipped.ok) assert.equal(flipped.code, "invalid");

    const staleSize = verifyDeliveryProof(replaceSignedField(mp3.uploadToken, '"size":27', '"size":28'), "delivery-upload");
    assert.equal(staleSize.ok, false);
    if (!staleSize.ok) assert.equal(staleSize.code, "invalid");
    const staleMime = verifyDeliveryProof(
      replaceSignedField(mp3.uploadToken, '"contentType":"audio/mpeg"', '"contentType":"audio/wav"'),
      "delivery-upload"
    );
    assert.equal(staleMime.ok, false);

    const future = Math.floor(Date.now() / 1000) + 60;
    const nonce = "0123456789abcdef";
    const baseClaims = {
      v: 1,
      reference: mp3.reference,
      size: 27,
      contentType: "audio/mpeg",
      exp: future,
      nonce,
    };
    const noPurpose = verifyDeliveryProof(signRaw(JSON.stringify(baseClaims)), "delivery-upload");
    assert.equal(noPurpose.ok, false);
    if (!noPurpose.ok) assert.equal(noPurpose.code, "invalid");
    const unknownPurpose = verifyDeliveryProof(
      signRaw(JSON.stringify({ ...baseClaims, purpose: "admin" })),
      "delivery-upload"
    );
    assert.equal(unknownPurpose.ok, false);
    const outside = verifyDeliveryProof(
      signRaw(JSON.stringify({ ...baseClaims, purpose: "delivery-commit", reference: "portfolio/arquivo.mp3" })),
      "delivery-commit"
    );
    assert.equal(outside.ok, false);
    const outsideIssue = issueDeliveryProof({
      purpose: "delivery-upload",
      reference: "r2:portfolio/arquivo.mp3",
      size: 27,
      contentType: "audio/mpeg",
      originalName: "arquivo.mp3",
      exp: future,
    });
    assert.equal(outsideIssue.ok, false);

    const malformed = verifyDeliveryProof("v1.%%% .não-é-json", "delivery-upload");
    assert.equal(malformed.ok, false);
    if (!malformed.ok) assert.equal(malformed.code, "invalid");
    const malformedConfirm = await confirmDeliveryUpload("v1.%%% .não-é-json", {
      head: headOf({ size: 27, contentType: "audio/mpeg", metadataKind: "delivery" }),
    });
    assert.equal(malformedConfirm.ok, false);
    if (!malformedConfirm.ok) {
      assert.equal(malformedConfirm.error, "Não foi possível confirmar o arquivo enviado. Tente novamente.");
      must(!malformedConfirm.error.includes("SyntaxError"), "erro interno vazou");
      must(!malformedConfirm.error.includes("http"), "erro citou URL");
    }

    const wrongSize = await confirmDeliveryUpload(mp3.uploadToken, {
      head: headOf({ size: 70 * 1024 * 1024, contentType: "audio/mpeg", metadataKind: "delivery" }),
    });
    assert.equal(wrongSize.ok, false);
    if (!wrongSize.ok) assert.equal(wrongSize.error, "Não foi possível confirmar o arquivo enviado. Tente novamente.");

    const wrongMime = await confirmDeliveryUpload(mp3.uploadToken, {
      head: headOf({ size: 27, contentType: "audio/wav", metadataKind: "delivery" }),
    });
    assert.equal(wrongMime.ok, false);

    const wrongMeta = await confirmDeliveryUpload(mp3.uploadToken, {
      head: headOf({ size: 27, contentType: "audio/mpeg", metadataKind: null }),
    });
    assert.equal(wrongMeta.ok, false);

    const missing = await confirmDeliveryUpload(mp3.uploadToken, {
      head: async () => r2Failure("missing"),
    });
    assert.equal(missing.ok, false);
    if (!missing.ok) assert.equal(missing.code, "rejected");

    const unavailable = await confirmDeliveryUpload(mp3.uploadToken, {
      head: async () => r2Failure("unconfigured"),
    });
    assert.equal(unavailable.ok, false);
    if (!unavailable.ok) assert.equal(unavailable.code, "unconfigured");

    const expiredIssued = issueDeliveryProof({
      purpose: "delivery-upload",
      reference: mp3.reference,
      size: 27,
      contentType: "audio/mpeg",
      originalName: "faixa.mp3",
      exp: Math.floor(Date.now() / 1000) - 30,
    });
    assert.equal(expiredIssued.ok, true);
    if (expiredIssued.ok) {
      const expired = verifyDeliveryProof(expiredIssued.token, "delivery-upload");
      assert.equal(expired.ok, false);
      if (!expired.ok) assert.equal(expired.code, "expired");
      const expiredConfirm = await confirmDeliveryUpload(expiredIssued.token, {
        head: headOf({ size: 27, contentType: "audio/mpeg", metadataKind: "delivery" }),
      });
      assert.equal(expiredConfirm.ok, false);
    }

    const tampered = `${mp3.uploadToken.slice(0, -1)}${mp3.uploadToken.endsWith("a") ? "b" : "a"}`;
    const tamperedProof = verifyDeliveryProof(tampered, "delivery-upload");
    assert.equal(tamperedProof.ok, false);
    if (!tamperedProof.ok) assert.equal(tamperedProof.code, "invalid");

    const arbitrary = assertDeliveryCommitProof(
      "r2:deliveries/11111111-1111-4111-8111-111111111111.mp3",
      confirmed.commitToken
    );
    assert.equal(arbitrary.ok, false);
    const withoutProof = assertDeliveryCommitProof(mp3.reference, undefined);
    assert.equal(withoutProof.ok, false);

    const blobUrl = "https://example.public.blob.vercel-storage.com/deliveries/legado.mp3";
    assert.equal(classifyDeliveryStorageReference(blobUrl).kind, "vercel_blob");
    assert.equal(assertDeliveryCommitProof(blobUrl, undefined).ok, true);
    assert.equal(validateDeliveryFieldReplacement(blobUrl, "mp3").ok, true);

    const localUrl = "/uploads/deliveries/dev-file.wav";
    assert.equal(classifyDeliveryStorageReference(localUrl).kind, "local");
    assert.equal(validateDeliveryFieldReplacement(localUrl, "wav").ok, true);
    setProcessEnv("NODE_ENV", "production");
    setProcessEnv("VERCEL_ENV", "production");
    assert.equal(validateDeliveryFieldReplacement(localUrl, "wav").ok, false);
  } finally {
    setProcessEnv("NODE_ENV", savedNode);
    setProcessEnv("VERCEL_ENV", savedVercel);
    restore(saved);
  }

  console.log("delivery-r2-upload-smoke ok");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "error";
  console.error(message.includes("example-secret") ? "smoke-failed" : message);
  process.exit(1);
});
