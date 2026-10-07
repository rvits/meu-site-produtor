/**
 * Smoke da proteção de entrega. Sem Blob real, sem Prisma, sem arquivo em memória.
 */
import assert from "node:assert/strict";
import { BlobStoreSuspendedError } from "@vercel/blob";
import {
  DELIVERY_NOT_FOUND,
  DELIVERY_STORAGE_BLOCK,
  DELIVERY_UNAVAILABLE,
  classifyBlobThrown,
  classifyHttpStatus,
  inspectDeliveryBlob,
  releaseUnreadBody,
  validateDeliveryAudioUrl,
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

  console.log("delivery-storage-smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
