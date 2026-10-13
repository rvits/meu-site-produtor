/**
 * Nome da entrega e download em um clique. Sem rede e sem banco.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  contentDispositionAttachment,
  deliveryPresentedName,
  sanitizeDeliveryOriginalName,
} from "../src/app/lib/delivery-filename";
import {
  DELIVERY_DOWNLOAD_UNAVAILABLE,
  probeDownloadDecision,
} from "../src/app/lib/delivery-download-ui";
import {
  assertDeliveryCommitProof,
  issueDeliveryProof,
  verifyDeliveryProof,
} from "../src/app/lib/storage/delivery-upload-proof";
import { confirmDeliveryUpload, prepareDeliveryUpload } from "../src/app/lib/storage/delivery-upload";
import { createDeliveryDownloadUrl } from "../src/app/lib/storage/r2-delivery";
import type { R2HeadSuccess } from "../src/app/lib/storage/r2-delivery";

const PROOF_TEST_SECRET = "delivery-proof-test-secret-not-real";
const KEY_RE = /^r2:deliveries\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.wav$/;
const FIXTURE_UUID = "5288d1aa-7960-42a6-9edd-5fd2bf0bfa3f";

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function claimsOf(token: string): Record<string, unknown> {
  const payload = token.split(".")[1] || "";
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Record<string, unknown>;
}

function headOf(size: number): () => Promise<R2HeadSuccess> {
  return async () => ({ ok: true, size, contentType: "audio/wav", metadataKind: "delivery" });
}

async function main() {
  assert.equal(sanitizeDeliveryOriginalName(`../../etc/passwd.wav`, "wav"), "passwd.wav");
  assert.equal(sanitizeDeliveryOriginalName("..\\..\\segredo.wav", "wav"), "segredo.wav");
  assert.equal(sanitizeDeliveryOriginalName("faixa\r\nSet-Cookie: x.wav", "wav"), "faixaSet-Cookie: x.wav");
  must(!sanitizeDeliveryOriginalName("a\r\nb.wav", "wav").includes("\r"), "CR sobreviveu");
  must(!sanitizeDeliveryOriginalName("a\r\nb.wav", "wav").includes("\n"), "LF sobreviveu");
  assert.equal(sanitizeDeliveryOriginalName("Música ção.wav", "wav"), "Música ção.wav");
  assert.equal(sanitizeDeliveryOriginalName(`"Ao Redor"- Rvits.wav`, "wav"), `"Ao Redor"- Rvits.wav`);
  assert.equal(sanitizeDeliveryOriginalName("song.mp3", "wav"), "song.wav");
  assert.equal(sanitizeDeliveryOriginalName("pasta/pacote.zip", "zip"), "pacote.zip");
  const long = `${"á".repeat(200)}.wav`;
  const limited = sanitizeDeliveryOriginalName(long, "wav");
  must(limited.length <= 120, "nome passou de 120");
  must(limited.endsWith(".wav"), "extensão perdida no corte");
  must(!limited.includes("/") && !limited.includes("\\"), "path sobreviveu");
  must(!sanitizeDeliveryOriginalName("entrega.wav", "wav").startsWith("deliveries/"), "nome virou key");

  const disposition = contentDispositionAttachment(`"Ao Redor"- Rvits.wav`);
  must(disposition.startsWith("attachment;"), "disposition não é attachment");
  must(disposition.includes("filename*=UTF-8''"), "filename* ausente");
  must(disposition.includes("%22Ao%20Redor%22"), "unicode/aspas não foram codificados");
  must(!disposition.includes("\r") && !disposition.includes("\n"), "header injection");
  must(!disposition.includes(`filename=""Ao`), "aspas cruas no parâmetro ASCII");

  const saved = {
    account: process.env.R2_ACCOUNT_ID,
    key: process.env.R2_ACCESS_KEY_ID,
    secret: process.env.R2_SECRET_ACCESS_KEY,
    bucket: process.env.R2_DELIVERIES_BUCKET,
    proof: process.env.DELIVERY_UPLOAD_PROOF_SECRET,
  };
  process.env.R2_ACCOUNT_ID = "localtest";
  process.env.R2_ACCESS_KEY_ID = "example-access-key";
  process.env.R2_SECRET_ACCESS_KEY = "example-secret";
  process.env.R2_DELIVERIES_BUCKET = "test-deliveries-bucket";
  process.env.DELIVERY_UPLOAD_PROOF_SECRET = PROOF_TEST_SECRET;

  try {
    const prepared = await prepareDeliveryUpload({
      fileName: `"Ao Redor"- Rvits.wav`,
      size: 34,
      contentType: "audio/wav",
    });
    assert.equal(prepared.ok, true);
    if (!prepared.ok) return;
    must(KEY_RE.test(prepared.reference), "key não é opaca");
    must(!prepared.reference.toLowerCase().includes("redor"), "nome entrou na key");
    must(!prepared.reference.includes("Rvits"), "nome entrou na key");
    const uploadClaims = claimsOf(prepared.uploadToken);
    assert.equal(uploadClaims.originalName, `"Ao Redor"- Rvits.wav`);
    assert.equal(uploadClaims.reference, prepared.reference);

    const tamperedName = prepared.uploadToken.split(".");
    const raw = Buffer.from(tamperedName[1] || "", "base64url").toString("utf8").replace("Rvits", "Outro");
    const forged = `${tamperedName[0]}.${Buffer.from(raw).toString("base64url")}.${tamperedName[2]}`;
    assert.equal(verifyDeliveryProof(forged, "delivery-upload").ok, false);

    const confirmed = await confirmDeliveryUpload(prepared.uploadToken, { head: headOf(34) });
    assert.equal(confirmed.ok, true);
    if (!confirmed.ok) return;
    const commitClaims = claimsOf(confirmed.commitToken);
    assert.equal(commitClaims.originalName, `"Ao Redor"- Rvits.wav`);
    assert.equal(commitClaims.reference, prepared.reference);
    const proof = assertDeliveryCommitProof(confirmed.deliveryAudioUrl, confirmed.commitToken);
    assert.equal(proof.ok, true);
    if (proof.ok) assert.equal(proof.originalName, `"Ao Redor"- Rvits.wav`);
    assert.equal(
      assertDeliveryCommitProof(confirmed.deliveryAudioUrl, confirmed.commitToken, "outro.wav").ok,
      false
    );
    assert.equal(assertDeliveryCommitProof(confirmed.deliveryAudioUrl, undefined).ok, false);

    const signed = await createDeliveryDownloadUrl({
      objectKey: prepared.reference.slice("r2:".length),
      responseContentType: "audio/wav",
      responseContentDisposition: "attachment",
      fileName: `"Ao Redor"- Rvits.wav`,
    });
    must(signed.ok, "presign falhou");
    if (signed.ok) {
      must(signed.url.includes("response-content-disposition"), "disposition não assinada");
      must(!signed.url.includes("\r") && !signed.url.includes("\n"), "url com quebra de linha");
      must(!signed.url.includes("Rvits.wav?"), "nome virou a key");
      must(signed.url.includes("deliveries%2F") || signed.url.includes("deliveries/"), "key opaca ausente");
    }

    const issued = issueDeliveryProof({
      purpose: "delivery-commit",
      reference: prepared.reference,
      size: 34,
      contentType: "audio/wav",
      originalName: "faixa.wav",
      exp: Math.floor(Date.now() / 1000) + 60,
    });
    assert.equal(issued.ok, true);
  } finally {
    const env = process.env as Record<string, string | undefined>;
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete env[name];
      else env[name] = value;
    };
    restore("R2_ACCOUNT_ID", saved.account);
    restore("R2_ACCESS_KEY_ID", saved.key);
    restore("R2_SECRET_ACCESS_KEY", saved.secret);
    restore("R2_DELIVERIES_BUCKET", saved.bucket);
    restore("DELIVERY_UPLOAD_PROOF_SECRET", saved.proof);
  }

  assert.equal(
    deliveryPresentedName({
      url: `/api/entregas/${FIXTURE_UUID}`,
      tipo: "mix",
      format: "wav",
    }),
    "Mix.wav"
  );
  assert.equal(
    deliveryPresentedName({ url: `/api/entregas/${FIXTURE_UUID}`, tipo: "master", format: "mp3" }),
    "Master.mp3"
  );
  assert.equal(deliveryPresentedName({ url: `/api/entregas/${FIXTURE_UUID}`, format: "zip" }), "Entrega.zip");
  assert.equal(
    deliveryPresentedName({
      originalName: `"Ao Redor"- Rvits.wav`,
      url: `/api/entregas/${FIXTURE_UUID}`,
      tipo: "mix",
      format: "wav",
    }),
    `"Ao Redor"- Rvits.wav`
  );
  assert.equal(
    deliveryPresentedName({
      url: "https://example.public.blob.vercel-storage.com/deliveries/legado.mp3",
      tipo: "mix",
      format: "mp3",
    }),
    "legado.mp3"
  );
  must(
    !deliveryPresentedName({ url: `/api/entregas/${FIXTURE_UUID}`, tipo: "mix", format: "wav" }).includes(FIXTURE_UUID),
    "fallback mostrou UUID"
  );

  assert.deepEqual(probeDownloadDecision(200, { ok: true }), { action: "download" });
  const unavailable = probeDownloadDecision(503, { error: "Arquivo não encontrado." });
  assert.equal(unavailable.action, "error");
  if (unavailable.action === "error") {
    assert.equal(unavailable.message, DELIVERY_DOWNLOAD_UNAVAILABLE);
    must(!unavailable.message.toLowerCase().includes("não encontrado"), "503 virou ausência");
  }
  assert.equal(probeDownloadDecision(404, { error: "Arquivo não encontrado." }).action, "error");
  assert.notEqual(probeDownloadDecision(404, {}).action, "download");
  assert.notEqual(probeDownloadDecision(401, {}).action, "download");
  assert.notEqual(probeDownloadDecision(500, {}).action, "download");

  const link = readFileSync("src/app/components/DeliveryDownloadLink.tsx", "utf8");
  must(link.includes("preventDefault"), "clique não impede o default");
  must(link.includes("x-delivery-probe"), "probe removido");
  must(link.includes("createElement(\"iframe\")"), "download não usa iframe");
  must(link.includes("withAttachmentDisposition"), "attachment não é pedido");
  must(!link.includes("window.location"), "aba atual é navegada");
  must(!link.includes("window.open"), "popup foi introduzido");
  must(!link.includes(".blob("), "arquivo inteiro entra em JS");
  must(!link.includes("Toque novamente"), "segundo clique voltou");
  const route = readFileSync("src/app/api/entregas/[serviceId]/route.ts", "utf8");
  must(route.includes("contentDispositionAttachment"), "legado não pede attachment");
  must(!route.includes(".blob("), "rota materializa o arquivo");
  must(route.includes("createDeliveryDownloadUrl"), "R2 deixou o redirect");
  const card = readFileSync("src/app/admin/servicos-ui/ServiceCard.tsx", "utf8");
  must(card.includes('preload="none"'), "player perdeu preload none");
  must(card.includes("src={s.deliveryAudioUrl"), "player deixou de usar o proxy");
  must(card.includes("deliveryPresentedName"), "card não usa o nome da entrega");

  console.log("delivery-filename-ux-smoke ok");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "smoke-failed";
  console.error(message.includes("example-secret") ? "smoke-failed" : message);
  process.exitCode = 1;
});
