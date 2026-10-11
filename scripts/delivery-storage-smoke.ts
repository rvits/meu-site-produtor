/**
 * Smoke da proteção de entrega. Sem Blob real, sem Prisma, sem arquivo em memória.
 */
import assert from "node:assert/strict";
import { BlobStoreSuspendedError } from "@vercel/blob";
import { classifyDeliveryStorageReference } from "../src/app/lib/delivery-access";
import {
  DELIVERY_NOT_FOUND,
  DELIVERY_STORAGE_BLOCK,
  DELIVERY_UNAVAILABLE,
  classifyBlobThrown,
  classifyHttpStatus,
  inspectDeliveryBlob,
  releaseUnreadBody,
  resolveDeliveryDownloadTarget,
  validateDeliveryAudioUrl,
  validateDeliveryFieldReplacement,
  type DeliveryByteReader,
  type DeliveryHead,
} from "../src/app/lib/delivery-storage";

const WAV =
  "https://example.public.blob.vercel-storage.com/deliveries/fixture-entrega.wav";
const PATH = "deliveries/fixture-entrega.wav";
const HUGE = 52_091_428;

function setProcessEnv(name: "NODE_ENV" | "VERCEL_ENV", value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[name];
  else env[name] = value;
}

function headOf(size = HUGE): DeliveryHead {
  return {
    url: WAV,
    pathname: PATH,
    size,
    contentType: "audio/wav",
  };
}

function reader(partial: Partial<DeliveryByteReader> & Pick<DeliveryByteReader, "head" | "rangeStatus">): DeliveryByteReader {
  return partial;
}

async function main() {
  const readable = reader({
    head: async () => headOf(),
    rangeStatus: async () => 206,
  });
  const ok = await inspectDeliveryBlob(WAV, readable);
  assert.equal(ok.ok, true, "blob legível permite a entrega");

  const missing = await inspectDeliveryBlob(WAV, reader({
    head: async () => null,
    rangeStatus: async () => {
      throw new Error("não deveria ler bytes de objeto inexistente");
    },
  }));
  assert.equal(missing.ok, false);
  if (!missing.ok) {
    assert.equal(missing.httpStatus, 404);
    assert.equal(missing.clientMessage, DELIVERY_NOT_FOUND);
    assert.equal(missing.clientMessage.includes("ausente"), false);
  }

  const suspended = await inspectDeliveryBlob(WAV, reader({
    head: async () => {
      throw new BlobStoreSuspendedError();
    },
    rangeStatus: async () => 500,
  }));
  assert.equal(suspended.ok, false);
  if (!suspended.ok) {
    assert.equal(suspended.httpStatus, 503);
    assert.equal(suspended.code, "store_suspended");
    assert.equal(suspended.clientMessage, DELIVERY_UNAVAILABLE);
    assert.equal(suspended.adminMessage, DELIVERY_STORAGE_BLOCK);
  }

  const forbidden = await validateDeliveryAudioUrl(WAV, {
    format: "wav",
    reader: reader({
      head: async () => headOf(),
      rangeStatus: async () => 403,
    }),
  });
  assert.equal(forbidden.ok, false);
  if (!forbidden.ok) {
    assert.equal(forbidden.httpStatus, 503);
    assert.equal(forbidden.error, DELIVERY_STORAGE_BLOCK);
    assert.equal(forbidden.error.includes("ausente"), false);
    assert.equal(forbidden.error.includes("não encontrado"), false);
  }
  const forbiddenHttp = classifyHttpStatus(403);
  assert.equal(forbiddenHttp.ok, false);
  if (!forbiddenHttp.ok) assert.equal(forbiddenHttp.httpStatus, 503);

  const unexpected = classifyBlobThrown(new Error("socket hang up"));
  assert.equal(unexpected.httpStatus, 502);
  assert.notEqual(unexpected.httpStatus, 404);
  assert.equal(unexpected.code, "blob_unexpected");

  const arbitrary = await validateDeliveryAudioUrl("https://example.com/faixa.wav", { format: "wav" });
  assert.equal(arbitrary.ok, false);
  if (!arbitrary.ok) assert.equal(arbitrary.httpStatus, 400);

  let otherHeadCalls = 0;
  const otherStore = await validateDeliveryAudioUrl(
    "https://example.public.blob.vercel-storage.com/portfolio/audio/faixa.wav",
    {
      format: "wav",
      reader: reader({
        head: async () => {
          otherHeadCalls += 1;
          return headOf();
        },
        rangeStatus: async () => 200,
      }),
    }
  );
  assert.equal(otherStore.ok, false);
  if (!otherStore.ok) assert.equal(otherStore.httpStatus, 400);
  assert.equal(otherHeadCalls, 0, "namespace alheio não consulta o store");

  const blocked = await validateDeliveryAudioUrl(WAV, {
    format: "wav",
    reader: reader({
      head: async () => headOf(),
      rangeStatus: async () => 403,
    }),
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.httpStatus, 503);

  let rangedUrl = "";
  const accepted = await validateDeliveryAudioUrl(WAV, {
    format: "wav",
    reader: reader({
      head: async () => headOf(),
      rangeStatus: async (url) => {
        rangedUrl = url;
        return 200;
      },
    }),
  });
  assert.equal(accepted.ok, true);
  assert.equal(rangedUrl, WAV);

  const also206 = await validateDeliveryAudioUrl(WAV, {
    format: "wav",
    reader: reader({
      head: async () => headOf(),
      rangeStatus: async () => 206,
    }),
  });
  assert.equal(also206.ok, true);

  let buffered = 0;
  const body = {
    cancel: async () => {
      buffered = 0;
    },
    arrayBuffer: async () => {
      buffered = HUGE;
      return new ArrayBuffer(HUGE);
    },
  };
  await releaseUnreadBody(body);
  assert.equal(buffered, 0, "leitura mínima não materializa o arquivo");
  assert.equal(typeof body.arrayBuffer, "function");

  const huge = await inspectDeliveryBlob(WAV, reader({
    head: async () => headOf(HUGE),
    rangeStatus: async () => 206,
  }));
  assert.equal(huge.ok, true);
  if (huge.ok) assert.equal(huge.pathname, PATH);

  const traversal = await validateDeliveryAudioUrl(
    "https://example.public.blob.vercel-storage.com/deliveries/%2e%2e/secret.wav",
    {
      format: "wav",
      reader: reader({
        head: async () => {
          throw new Error("traversal não pode consultar o store");
        },
        rangeStatus: async () => 200,
      }),
    }
  );
  assert.equal(traversal.ok, false);

  const savedNodeEnv = process.env.NODE_ENV;
  const savedVercelEnv = process.env.VERCEL_ENV;
  try {
    setProcessEnv("NODE_ENV", "development");
    setProcessEnv("VERCEL_ENV", undefined);
    for (const localUrl of [
      "/uploads/deliveries/te02a-delivery.wav",
      "/uploads/deliveries/sync01a-delivery.wav",
      "/uploads/deliveries/sim01-delivery.wav",
      "/uploads/deliveries/ph01.wav",
      "/uploads/deliveries/rc03.wav",
      "/uploads/deliveries/rc02-delivery-v2.wav",
    ]) {
      const local = await validateDeliveryAudioUrl(localUrl, { format: "wav" });
      assert.equal(local.ok, true, localUrl);
    }

    setProcessEnv("NODE_ENV", "production");
    setProcessEnv("VERCEL_ENV", "production");
    const fakeLocal = await validateDeliveryAudioUrl("/uploads/deliveries/falso.wav", { format: "wav" });
    assert.equal(fakeLocal.ok, false);
    if (!fakeLocal.ok) assert.equal(fakeLocal.httpStatus, 400);
  } finally {
    setProcessEnv("NODE_ENV", savedNodeEnv);
    setProcessEnv("VERCEL_ENV", savedVercelEnv);
  }

  const blobRef = classifyDeliveryStorageReference(WAV);
  assert.equal(blobRef.kind, "vercel_blob");
  if (blobRef.kind === "vercel_blob") assert.equal(blobRef.pathname, PATH);

  for (const ref of ["r2:deliveries/file.wav", "r2:deliveries/file.mp3", "r2:deliveries/file.zip"]) {
    const classified = classifyDeliveryStorageReference(ref);
    assert.equal(classified.kind, "r2", ref);
  }
  assert.equal(classifyDeliveryStorageReference("/uploads/deliveries/faixa.wav").kind, "local");

  for (const ref of [
    "https://example.com/faixa.wav",
    "javascript:alert(1)",
    "data:audio/wav,abc",
    "r2:portfolio/file.wav",
    "r2:deliveries/",
    "r2:deliveries/../secret.wav",
    "r2:deliveries/%2e%2e/secret.wav",
    "r2:deliveries/foo//bar.wav",
    "r2:deliveries/foo\\bar.wav",
    "r2:deliveries/file.exe",
    "r2:http://example.com/file.wav",
  ]) {
    assert.equal(classifyDeliveryStorageReference(ref).kind, "invalid", ref);
  }

  const r2Target = resolveDeliveryDownloadTarget("r2:deliveries/file.wav");
  assert.equal(r2Target.kind, "r2");
  if (r2Target.kind === "r2") assert.equal(r2Target.objectKey, "deliveries/file.wav");
  assert.notEqual(resolveDeliveryDownloadTarget("https://example.com/faixa.wav").kind, "r2");

  const arbitraryField = validateDeliveryFieldReplacement("https://example.com/faixa.wav", "wav");
  assert.equal(arbitraryField.ok, false);
  const r2Field = validateDeliveryFieldReplacement("r2:deliveries/file.wav", "wav");
  assert.equal(r2Field.ok, true);
  const blobField = validateDeliveryFieldReplacement(WAV, "wav");
  assert.equal(blobField.ok, true);

  const r2Env = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_DELIVERIES_BUCKET"] as const;
  const savedR2: Record<string, string | undefined> = {};
  for (const key of r2Env) savedR2[key] = process.env[key];
  try {
    for (const key of r2Env) delete process.env[key];
    let r2HeadCalls = 0;
    const closed = await validateDeliveryAudioUrl("r2:deliveries/file.wav", {
      format: "wav",
      r2Reader: {
        head: async () => {
          r2HeadCalls += 1;
          return { ok: false, code: "unconfigured" };
        },
      },
    });
    assert.equal(r2HeadCalls, 1);
    assert.equal(closed.ok, false);
    if (!closed.ok) {
      assert.equal(closed.httpStatus, 503);
      assert.notEqual(closed.httpStatus, 404);
      assert.equal(closed.error, DELIVERY_STORAGE_BLOCK);
      assert.equal(closed.error.includes("não encontrado"), false);
    }

    const withoutReader = await validateDeliveryAudioUrl("r2:deliveries/file.wav", { format: "wav" });
    assert.equal(withoutReader.ok, false);
    if (!withoutReader.ok) {
      assert.equal(withoutReader.httpStatus, 503);
      assert.equal(withoutReader.code, "unconfigured");
    }

    setProcessEnv("NODE_ENV", "production");
    setProcessEnv("VERCEL_ENV", "production");
    const productionStringOnly = await validateDeliveryAudioUrl("r2:deliveries/file.wav", { format: "wav" });
    assert.equal(productionStringOnly.ok, false);
    if (!productionStringOnly.ok) assert.equal(productionStringOnly.httpStatus, 503);

    let seenKey = "";
    const present = await validateDeliveryAudioUrl("r2:deliveries/file.wav", {
      format: "wav",
      r2Reader: {
        head: async (objectKey) => {
          seenKey = objectKey;
          return { ok: true, size: 12, contentType: "audio/wav" };
        },
      },
    });
    assert.equal(present.ok, true);
    assert.equal(seenKey, "deliveries/file.wav");

    const missingR2 = await validateDeliveryAudioUrl("r2:deliveries/file.mp3", {
      format: "mp3",
      r2Reader: { head: async () => ({ ok: false, httpStatus: 404 }) },
    });
    assert.equal(missingR2.ok, false);
    if (!missingR2.ok) {
      assert.equal(missingR2.httpStatus, 404);
      assert.equal(missingR2.error, DELIVERY_NOT_FOUND);
    }

    const forbiddenR2 = await validateDeliveryAudioUrl("r2:deliveries/file.zip", {
      format: "zip",
      r2Reader: { head: async () => ({ ok: false, httpStatus: 403 }) },
    });
    assert.equal(forbiddenR2.ok, false);
    if (!forbiddenR2.ok) {
      assert.equal(forbiddenR2.httpStatus, 503);
      assert.equal(forbiddenR2.code, "blob_forbidden");
      assert.equal(forbiddenR2.error.includes("não encontrado"), false);
    }

    const upstreamR2 = await validateDeliveryAudioUrl("r2:deliveries/file.wav", {
      format: "wav",
      r2Reader: { head: async () => ({ ok: false, httpStatus: 503 }) },
    });
    assert.equal(upstreamR2.ok, false);
    if (!upstreamR2.ok) {
      assert.equal(upstreamR2.httpStatus, 503);
      assert.notEqual(upstreamR2.code, "missing");
    }
  } finally {
    for (const key of r2Env) {
      if (savedR2[key] === undefined) delete process.env[key];
      else process.env[key] = savedR2[key];
    }
    setProcessEnv("NODE_ENV", savedNodeEnv);
    setProcessEnv("VERCEL_ENV", savedVercelEnv);
  }

  console.log("delivery-storage-smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
