/**
 * Smoke da Fase 4. Sem banco e sem rede.
 * A URL fictícia abaixo só existe para conferir o redirect; não é impressa.
 */
import assert from "node:assert/strict";
import { withAttachmentDisposition } from "../src/app/lib/delivery-disposition";
import {
  deliveryDownloadFileName,
  deliveryDownloadResponse,
  resolveDeliveryDownload,
  type DeliveryAccessService,
  type DeliveryAccessUser,
} from "../src/app/lib/storage/delivery-download";
import { createDeliveryDownloadUrl, R2_SIGNED_URL_TTL_SECONDS, r2Failure } from "../src/app/lib/storage/r2-delivery";

const KEY = "deliveries/phase4-marker.mp3";
const REFERENCE = `r2:${KEY}`;
const SIGNED =
  "https://localtest.r2.cloudflarestorage.com/test-deliveries-bucket/deliveries/phase4-marker.mp3?X-Amz-Expires=120&X-Amz-Signature=fake";

const owner: DeliveryAccessUser = { id: "owner-1", role: "CLIENT" };
const other: DeliveryAccessUser = { id: "other-2", role: "CLIENT" };
const admin: DeliveryAccessUser = { id: "admin-9", role: "ADMIN" };

function setProcessEnv(name: "NODE_ENV" | "VERCEL_ENV", value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[name];
  else env[name] = value;
}

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function service(overrides?: Partial<DeliveryAccessService>): DeliveryAccessService {
  return {
    userId: "owner-1",
    deliveryAudioUrl: REFERENCE,
    deliveryAudioFormat: "mp3",
    tipo: "mixagem",
    ...overrides,
  };
}

function harness(headCode?: "ok" | "missing" | "unconfigured" | "forbidden" | "upstream" | "throw") {
  const heads: string[] = [];
  const downloads: Array<{
    responseContentDisposition?: string;
    fileName?: string;
    objectKey?: string;
    responseContentType?: string;
  }> = [];
  return {
    heads,
    downloads,
    deps: {
      headObject: async (objectKey: string) => {
        heads.push(objectKey);
        if (headCode === "throw") throw new Error("example-secret upstream");
        if (headCode && headCode !== "ok") return r2Failure(headCode);
        return { ok: true as const, size: 22, contentType: "audio/mpeg", metadataKind: "delivery" };
      },
      createDownloadUrl: async (input: {
        objectKey: string;
        responseContentDisposition?: "inline" | "attachment";
        responseContentType?: string;
        fileName?: string;
      }) => {
        downloads.push(input);
        return { ok: true as const, url: SIGNED, expiresIn: 120 };
      },
    },
  };
}

async function main() {
  assert.equal(R2_SIGNED_URL_TTL_SECONDS, 120);
  assert.equal(deliveryDownloadFileName("mixagem", "mp3"), "thouse-mixagem.mp3");
  assert.equal(deliveryDownloadFileName("masterizacao", "wav"), "thouse-masterizacao.wav");
  assert.equal(deliveryDownloadFileName("beat", "zip"), "thouse-beat.zip");
  assert.equal(deliveryDownloadFileName("../cliente nome", "mp3"), "thouse-cliente-nome.mp3");
  must(!deliveryDownloadFileName("mixagem", "mp3").includes(KEY), "nome usou a key");
  assert.equal(withAttachmentDisposition("/api/entregas/abc"), "/api/entregas/abc?disposition=attachment");
  must(
    withAttachmentDisposition("/api/entregas/abc?x=1").includes("disposition=attachment"),
    "segundo clique perdeu attachment"
  );

  const savedNode = process.env.NODE_ENV;
  const savedVercel = process.env.VERCEL_ENV;
  const r2Env = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_DELIVERIES_BUCKET"] as const;
  const savedR2: Record<string, string | undefined> = {};
  for (const key of r2Env) savedR2[key] = process.env[key];

  try {
    const open = harness();
    const ownerGet = await resolveDeliveryDownload({
      user: owner,
      service: service(),
      method: "GET",
      probe: false,
      disposition: "inline",
      deps: open.deps,
    });
    must(ownerGet.type === "redirect" && ownerGet.status === 302, "owner não recebeu redirect temporário");
    if (ownerGet.type === "redirect") {
      must(ownerGet.location === SIGNED, "location não é o resultado do presigner");
      const response = deliveryDownloadResponse(ownerGet);
      assert.equal(response.status, 302);
      assert.equal(response.headers.get("Cache-Control"), "private, no-store");
      must((await response.text()) === "", "redirect devolveu corpo");
      must(!(await deliveryDownloadResponse(ownerGet).text()).includes("X-Amz"), "corpo citou a url");
    }
    assert.deepEqual(open.heads, [KEY]);
    assert.equal(open.downloads.length, 1);
    assert.equal(open.downloads[0]?.fileName, "thouse-mixagem.mp3");
    assert.equal(open.downloads[0]?.responseContentDisposition, "inline");
    assert.equal(open.downloads[0]?.responseContentType, "audio/mpeg");
    assert.equal(open.downloads[0]?.objectKey, KEY);

    const asAdmin = harness();
    const adminGet = await resolveDeliveryDownload({
      user: admin,
      service: service(),
      method: "GET",
      probe: false,
      disposition: "attachment",
      deps: asAdmin.deps,
    });
    must(adminGet.type === "redirect", "admin não recebeu redirect");
    assert.equal(asAdmin.downloads[0]?.responseContentDisposition, "attachment");
    assert.equal(asAdmin.downloads[0]?.fileName, "thouse-mixagem.mp3");

    const denied = harness();
    const forbidden = await resolveDeliveryDownload({
      user: other,
      service: service(),
      method: "GET",
      probe: false,
      disposition: "inline",
      deps: denied.deps,
    });
    must(forbidden.type === "json" && forbidden.status === 403, "outro usuário não foi recusado");
    assert.equal(denied.heads.length, 0);
    assert.equal(denied.downloads.length, 0);

    const anon = harness();
    const unsigned = await resolveDeliveryDownload({
      user: null,
      service: service(),
      method: "GET",
      probe: false,
      disposition: "inline",
      deps: anon.deps,
    });
    must(unsigned.type === "json" && unsigned.status === 401, "sem sessão não foi recusado");
    assert.equal(anon.heads.length, 0);

    for (const bad of ["r2:portfolio/phase4-marker.mp3", "r2:deliveries/../secret.mp3", "r2:deliveries/file.exe"]) {
      const rejected = harness();
      const command = await resolveDeliveryDownload({
        user: owner,
        service: service({ deliveryAudioUrl: bad }),
        method: "GET",
        probe: false,
        disposition: "inline",
        deps: rejected.deps,
      });
      must(command.type === "json" && command.status === 404, "referência inválida foi assinada");
      if (command.type === "json") {
        must(!JSON.stringify(command.body).includes("phase4-marker"), "erro citou a key");
        must(!JSON.stringify(command.body).includes("portfolio"), "erro citou o namespace");
      }
      assert.equal(rejected.downloads.length, 0);
      assert.equal(rejected.heads.length, 0);
    }

    const missing = harness("missing");
    const absent = await resolveDeliveryDownload({
      user: owner,
      service: service(),
      method: "GET",
      probe: false,
      disposition: "inline",
      deps: missing.deps,
    });
    must(absent.type === "json" && absent.status === 404, "objeto ausente não foi 404");
    if (absent.type === "json") {
      assert.equal("error" in absent.body ? absent.body.error : "", "Arquivo não encontrado.");
      must(!JSON.stringify(absent.body).includes(KEY), "404 citou a key");
    }
    assert.equal(missing.downloads.length, 0);

    for (const code of ["unconfigured", "forbidden", "upstream"] as const) {
      const down = harness(code);
      const command = await resolveDeliveryDownload({
        user: owner,
        service: service(),
        method: "GET",
        probe: false,
        disposition: "inline",
        deps: down.deps,
      });
      must(command.type === "json" && command.status === 503, `${code} não foi 503`);
      if (command.type === "json" && "error" in command.body) {
        must(!command.body.error.toLowerCase().includes("ausente"), "indisponibilidade virou ausência");
        must(!command.body.error.includes(KEY), "503 citou a key");
        must(!command.body.error.includes("example-secret"), "503 citou segredo");
        must(!JSON.stringify(command.body).includes(SIGNED), "503 devolveu url");
      }
      assert.equal(down.downloads.length, 0);
    }

    const exploded = harness("throw");
    const unexpected = await resolveDeliveryDownload({
      user: owner,
      service: service(),
      method: "GET",
      probe: false,
      disposition: "inline",
      deps: exploded.deps,
    });
    must(unexpected.type === "json" && unexpected.status === 503, "exceção não foi 503");
    if (unexpected.type === "json") must(!JSON.stringify(unexpected.body).includes("example-secret"), "exceção vazou");

    const probed = harness();
    const probe = await resolveDeliveryDownload({
      user: owner,
      service: service(),
      method: "GET",
      probe: true,
      disposition: "inline",
      deps: probed.deps,
    });
    must(probe.type === "json" && probe.status === 200, "probe não confirmou");
    if (probe.type === "json") {
      assert.deepEqual(probe.body, { ok: true });
      must(!JSON.stringify(probe.body).includes("X-Amz"), "probe devolveu url");
    }
    assert.equal(probed.downloads.length, 0);

    const headed = harness();
    const headOk = await resolveDeliveryDownload({
      user: owner,
      service: service(),
      method: "HEAD",
      probe: false,
      disposition: "inline",
      deps: headed.deps,
    });
    must(headOk.type === "head" && headOk.status === 200, "HEAD existente falhou");
    if (headOk.type === "head") {
      const response = deliveryDownloadResponse(headOk);
      assert.equal(response.status, 200);
      must((await response.text()) === "", "HEAD devolveu corpo");
    }
    assert.equal(headed.downloads.length, 0);

    const headMissing = await resolveDeliveryDownload({
      user: owner,
      service: service(),
      method: "HEAD",
      probe: false,
      disposition: "inline",
      deps: harness("missing").deps,
    });
    must(headMissing.type === "head" && headMissing.status === 404, "HEAD ausente falhou");

    const headDown = await resolveDeliveryDownload({
      user: owner,
      service: service(),
      method: "HEAD",
      probe: false,
      disposition: "inline",
      deps: harness("unconfigured").deps,
    });
    must(headDown.type === "head" && headDown.status === 503, "HEAD indisponível falhou");

    const blob = harness();
    const legacyBlob = await resolveDeliveryDownload({
      user: owner,
      service: service({
        deliveryAudioUrl: "https://example.public.blob.vercel-storage.com/deliveries/faixa.mp3",
      }),
      method: "GET",
      probe: false,
      disposition: "inline",
      deps: blob.deps,
    });
    must(legacyBlob.type === "legacy", "blob legado saiu do caminho antigo");
    assert.equal(blob.heads.length, 0);
    assert.equal(blob.downloads.length, 0);

    setProcessEnv("NODE_ENV", "development");
    setProcessEnv("VERCEL_ENV", undefined);
    const localDev = await resolveDeliveryDownload({
      user: owner,
      service: service({ deliveryAudioUrl: "/uploads/deliveries/faixa.mp3" }),
      method: "GET",
      probe: false,
      disposition: "inline",
      deps: harness().deps,
    });
    must(localDev.type === "legacy", "local de development foi recusado");

    setProcessEnv("NODE_ENV", "production");
    setProcessEnv("VERCEL_ENV", "production");
    const localProd = await resolveDeliveryDownload({
      user: owner,
      service: service({ deliveryAudioUrl: "/uploads/deliveries/faixa.mp3" }),
      method: "GET",
      probe: false,
      disposition: "inline",
      deps: harness().deps,
    });
    must(localProd.type === "json" && localProd.status === 404, "local de production foi aceito");

    for (const key of r2Env) delete process.env[key];
    process.env.R2_ACCOUNT_ID = "localtest";
    process.env.R2_ACCESS_KEY_ID = "example-access-key";
    process.env.R2_SECRET_ACCESS_KEY = "example-secret";
    process.env.R2_DELIVERIES_BUCKET = "test-deliveries-bucket";
    const real = await createDeliveryDownloadUrl({
      objectKey: "deliveries/file.mp3",
      responseContentType: "audio/mpeg",
      responseContentDisposition: "inline",
      fileName: "thouse-mixagem.mp3",
    });
    must(real.ok, "presigner local falhou");
    if (real.ok) {
      assert.equal(real.expiresIn, 120);
      must(real.url.includes("X-Amz-Expires=120"), "ttl do GET não é 120");
      must(real.url.includes("response-content-disposition"), "disposition não foi assinada");
      must(real.url.includes("response-content-type"), "content-type não foi assinado");
      must(!real.url.includes("example-secret"), "segredo apareceu na url");
      must(!real.url.includes("X-Amz-Expires=900"), "GET herdou o ttl de upload");
    }

    console.log("delivery-r2-download-smoke ok");
  } catch (error) {
    const message = error instanceof Error ? error.message : "smoke-failed";
    console.error(message.includes("example-secret") || message.includes("X-Amz-Signature") ? "smoke-failed" : message);
    process.exitCode = 1;
  } finally {
    setProcessEnv("NODE_ENV", savedNode);
    setProcessEnv("VERCEL_ENV", savedVercel);
    for (const key of r2Env) {
      if (savedR2[key] === undefined) delete process.env[key];
      else process.env[key] = savedR2[key];
    }
  }
}

void main();
