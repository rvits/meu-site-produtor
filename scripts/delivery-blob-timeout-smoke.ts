/**
 * Timeout da leitura Blob legada. Sem rede, sem Prisma, sem token impresso.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BlobNotFoundError, BlobStoreSuspendedError } from "@vercel/blob";
import {
  DELIVERY_BLOB_READ_TIMEOUT_MS,
  DELIVERY_NOT_FOUND,
  DELIVERY_UNAVAILABLE,
  DeliveryBlobTimeoutError,
  classifyBlobThrown,
  classifyHttpStatus,
  deliveryBlobFailureLog,
  inspectDeliveryBlob,
  legacyBlobClientError,
  openLegacyBlobGet,
  readLegacyBlobHead,
  readLegacyBlobRangeStatus,
  validateDeliveryAudioUrl,
  type DeliveryHead,
} from "../src/app/lib/delivery-storage";

const WAV = "https://example.public.blob.vercel-storage.com/deliveries/fixture-entrega.wav";
const PATHNAME = "deliveries/fixture-entrega.wav";
const QUICK_MS = 40;

function headOf(): DeliveryHead {
  return { url: WAV, pathname: PATHNAME, size: 22, contentType: "audio/wav" };
}

function hang(signal: AbortSignal, mark: { aborted: boolean }, name: string): Promise<never> {
  return new Promise((_resolve, reject) => {
    signal.addEventListener(
      "abort",
      () => {
        mark.aborted = true;
        reject(Object.assign(new Error("The request was aborted."), { name }));
      },
      { once: true }
    );
  });
}

function setProcessEnv(name: "NODE_ENV" | "VERCEL_ENV", value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[name];
  else env[name] = value;
}

async function main() {
  assert.equal(DELIVERY_BLOB_READ_TIMEOUT_MS, 8_000);

  const head = await readLegacyBlobHead(PATHNAME, async (_pathname, options) => {
    assert.equal(options.abortSignal.aborted, false);
    return headOf();
  }, 200);
  assert.equal(head.pathname, PATHNAME);
  assert.equal(head.contentType, "audio/wav");

  const opened = await openLegacyBlobGet(PATHNAME, async () => ({
    statusCode: 200,
    stream: new ReadableStream<Uint8Array>(),
    blob: { contentType: "audio/mpeg" },
  }), 200);
  assert.equal(opened.ok, true);
  if (opened.ok) assert.equal(opened.contentType, "audio/mpeg");

  await assert.rejects(
    readLegacyBlobHead(PATHNAME, async () => {
      throw new BlobNotFoundError();
    }, 200),
    (error: unknown) => error instanceof BlobNotFoundError
  );
  const missing = classifyBlobThrown(new BlobNotFoundError());
  assert.equal(missing.httpStatus, 404);
  assert.equal(missing.code, "missing");
  assert.equal(missing.clientMessage, DELIVERY_NOT_FOUND);
  assert.notEqual(missing.code, "storage_timeout");

  const suspended = classifyBlobThrown(new BlobStoreSuspendedError());
  assert.equal(suspended.httpStatus, 503);
  assert.equal(suspended.code, "store_suspended");
  assert.equal(suspended.clientMessage, DELIVERY_UNAVAILABLE);
  const forbidden = classifyHttpStatus(403);
  assert.equal(forbidden.ok, false);
  if (!forbidden.ok) {
    assert.equal(forbidden.httpStatus, 503);
    assert.equal(forbidden.code, "blob_forbidden");
    assert.notEqual(forbidden.code, "storage_timeout");
  }

  const headAbort = { aborted: false };
  const headStarted = Date.now();
  await assert.rejects(
    readLegacyBlobHead(
      PATHNAME,
      (_pathname, options) => hang(options.abortSignal, headAbort, "BlobRequestAbortedError"),
      QUICK_MS
    ),
    (error: unknown) => error instanceof DeliveryBlobTimeoutError
  );
  assert.equal(headAbort.aborted, true);
  assert.ok(Date.now() - headStarted < 1_000);

  const fetchAbort = { aborted: false };
  let sawRange = false;
  const fetchStarted = Date.now();
  await assert.rejects(
    readLegacyBlobRangeStatus(
      WAV,
      (_url, init) => {
        sawRange = init.headers.Range === "bytes=0-0";
        return hang(init.signal, fetchAbort, "AbortError");
      },
      QUICK_MS
    ),
    (error: unknown) => error instanceof DeliveryBlobTimeoutError
  );
  assert.equal(sawRange, true);
  assert.equal(fetchAbort.aborted, true);
  assert.ok(Date.now() - fetchStarted < 1_000);

  const ignored = { aborted: false };
  await assert.rejects(
    readLegacyBlobHead(
      PATHNAME,
      (_pathname, options) =>
        new Promise(() => {
          options.abortSignal.addEventListener("abort", () => {
            ignored.aborted = true;
          });
        }),
      QUICK_MS
    ),
    (error: unknown) => error instanceof DeliveryBlobTimeoutError
  );
  assert.equal(ignored.aborted, true, "AbortSignal dispara mesmo se a Promise não rejeitar");

  const stalled = await openLegacyBlobGet(
    PATHNAME,
    (_pathname, options) => hang(options.abortSignal, { aborted: false }, "AbortError"),
    QUICK_MS
  );
  assert.equal(stalled.ok, false);
  if (!stalled.ok) {
    assert.equal(stalled.code, "storage_timeout");
    assert.equal(stalled.httpStatus, 503);
    assert.notEqual(stalled.httpStatus, 404);
    assert.equal(stalled.clientMessage, DELIVERY_UNAVAILABLE);
    const player = legacyBlobClientError(stalled, "GET");
    const probe = legacyBlobClientError(stalled, "GET");
    const headResponse = legacyBlobClientError(stalled, "HEAD");
    assert.deepEqual(player.json, { error: DELIVERY_UNAVAILABLE });
    assert.equal(player.status, 503);
    assert.deepEqual(probe.json, player.json);
    assert.equal(headResponse.json, null);
    assert.equal(headResponse.status, 503);
    const log = deliveryBlobFailureLog(stalled.code, stalled.blobStatus);
    assert.equal(log.category, "storage_timeout");
    assert.equal(log.provider, "vercel_blob");
    assert.equal(log.blobStatus, null);
    assert.equal(JSON.stringify(log).includes("blob.vercel-storage.com"), false);
  }

  const inspected = await inspectDeliveryBlob(WAV, {
    head: async () => {
      throw new DeliveryBlobTimeoutError();
    },
    rangeStatus: async () => 206,
  });
  assert.equal(inspected.ok, false);
  if (!inspected.ok) {
    assert.equal(inspected.code, "storage_timeout");
    assert.equal(inspected.httpStatus, 503);
  }

  const r2Files = [
    "src/app/lib/storage/r2-delivery.ts",
    "src/app/lib/storage/r2-client.ts",
    "src/app/lib/storage/delivery-download.ts",
    "src/app/api/admin/servicos/upload-entrega/route.ts",
    "src/app/api/admin/servicos/upload-entrega/prepare/route.ts",
  ];
  for (const file of r2Files) {
    const source = readFileSync(path.join(process.cwd(), file), "utf8");
    assert.equal(source.includes("runLegacyBlobRead"), false, file);
    assert.equal(source.includes("DELIVERY_BLOB_READ_TIMEOUT_MS"), false, file);
  }

  const r2 = await validateDeliveryAudioUrl("r2:deliveries/file.wav", {
    format: "wav",
    r2Reader: {
      head: async () => ({ ok: true, size: 12, contentType: "audio/wav" }),
    },
  });
  assert.equal(r2.ok, true);

  const r2Started = Date.now();
  const r2Hang = validateDeliveryAudioUrl("r2:deliveries/file.wav", {
    format: "wav",
    r2Reader: { head: () => new Promise(() => undefined) },
  });
  const r2Winner = await Promise.race([
    r2Hang.then((result) => ({ settled: true as const, result })),
    new Promise<{ settled: false }>((resolve) => setTimeout(() => resolve({ settled: false }), 80)),
  ]);
  assert.equal(r2Winner.settled, false);
  assert.ok(Date.now() - r2Started < 500);

  const savedNodeEnv = process.env.NODE_ENV;
  const savedVercelEnv = process.env.VERCEL_ENV;
  try {
    setProcessEnv("NODE_ENV", "development");
    setProcessEnv("VERCEL_ENV", undefined);
    const localStarted = Date.now();
    const local = await validateDeliveryAudioUrl("/uploads/deliveries/timeout-fixture.wav", {
      format: "wav",
    });
    assert.equal(local.ok, true);
    assert.ok(Date.now() - localStarted < 500);
  } finally {
    setProcessEnv("NODE_ENV", savedNodeEnv);
    setProcessEnv("VERCEL_ENV", savedVercelEnv);
  }

  console.log("delivery-blob-timeout-smoke ok");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
