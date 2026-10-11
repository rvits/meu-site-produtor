/**
 * Leitura e validação de entregas.
 * Blob legado: metadata + no máximo 1 byte. O corpo nunca é acumulado em Buffer.
 * R2: head injetável nesta fase. A URL assinada não é gravada aqui.
 */
import {
  BlobNotFoundError,
  BlobStoreSuspendedError,
  get,
  head,
} from "@vercel/blob";
import {
  blobPathnameFromUrl,
  classifyDeliveryStorageReference,
  isVercelBlobUrl,
  safeDeliveryPathname,
  type DeliveryAudioExtension,
} from "./delivery-access";
import { headDeliveryObject } from "./storage/r2-delivery";

export { deliveryExtension } from "./delivery-access";

if (typeof window !== "undefined") {
  throw new Error("delivery-storage só pode ser usado no servidor.");
}

export const DELIVERY_NOT_FOUND = "Arquivo não encontrado.";
export const DELIVERY_UNAVAILABLE =
  "Arquivo temporariamente indisponível. Tente novamente mais tarde.";
export const DELIVERY_STORAGE_BLOCK =
  "Não foi possível validar o arquivo de entrega porque o armazenamento está temporariamente indisponível. Tente novamente mais tarde.";
export const DELIVERY_INVALID = "Faça upload do arquivo (WAV/MP3/ZIP). Caminho inválido.";

/**
 * `/uploads/deliveries/` só é gravado quando não há Blob (dev/teste).
 * Em Production o upload usa o token Blob; o disco da função não prova o arquivo.
 */
export function localDeliveryReferenceAllowed(): boolean {
  if (process.env.VERCEL_ENV === "production") return false;
  if (process.env.NODE_ENV === "production") return false;
  return true;
}

export type DeliveryFailureCode =
  | "missing"
  | "invalid"
  | "store_suspended"
  | "blob_forbidden"
  | "blob_upstream"
  | "blob_unexpected"
  | "unconfigured";

export type DeliveryReadFailure = {
  ok: false;
  httpStatus: 400 | 404 | 502 | 503;
  clientMessage: string;
  adminMessage: string;
  code: DeliveryFailureCode;
  blobStatus?: number;
};

export type DeliveryReadOk = {
  ok: true;
  kind: "local" | "blob" | "r2";
  pathname: string | null;
};

/** Resultado de Head do R2. httpStatus só entra quando a chamada foi tentada. */
export type R2DeliveryHeadResult =
  | { ok: true; size?: number | null; contentType?: string | null }
  | { ok: false; httpStatus: number }
  | { ok: false; code: "unconfigured" | "invalid_reference" };

export type R2DeliveryReader = {
  head: (objectKey: string) => Promise<R2DeliveryHeadResult>;
};

export type DeliveryDownloadTarget =
  | { kind: "vercel_blob"; pathname: string }
  | { kind: "r2"; objectKey: string; mode: "presign_later" }
  | { kind: "local" }
  | { kind: "legacy_https" }
  | { kind: "local_or_missing" };

export type DeliveryHead = {
  url: string;
  pathname: string;
  size: number;
  contentType: string;
};

/** Leitor injetável. O padrão usa head() e um GET com Range, cancelando o corpo. */
export type DeliveryByteReader = {
  head: (pathname: string) => Promise<DeliveryHead | null>;
  rangeStatus: (url: string) => Promise<number>;
};

export type DeliveryUrlValidationResult =
  | { ok: true; isLocalUpload?: boolean }
  | {
      ok: false;
      error: string;
      httpStatus: 400 | 404 | 502 | 503;
      code: DeliveryFailureCode;
    };

function failMissing(blobStatus?: number): DeliveryReadFailure {
  return {
    ok: false,
    httpStatus: 404,
    clientMessage: DELIVERY_NOT_FOUND,
    adminMessage: DELIVERY_NOT_FOUND,
    code: "missing",
    blobStatus,
  };
}

function failInvalid(error = DELIVERY_INVALID): DeliveryReadFailure {
  return {
    ok: false,
    httpStatus: 400,
    clientMessage: DELIVERY_NOT_FOUND,
    adminMessage: error,
    code: "invalid",
  };
}

function failUnavailable(code: DeliveryFailureCode, blobStatus?: number): DeliveryReadFailure {
  return {
    ok: false,
    httpStatus: 503,
    clientMessage: DELIVERY_UNAVAILABLE,
    adminMessage: DELIVERY_STORAGE_BLOCK,
    code,
    blobStatus,
  };
}

function failUnexpected(blobStatus?: number): DeliveryReadFailure {
  return {
    ok: false,
    httpStatus: 502,
    clientMessage: DELIVERY_UNAVAILABLE,
    adminMessage: DELIVERY_STORAGE_BLOCK,
    code: "blob_unexpected",
    blobStatus,
  };
}

export { safeDeliveryPathname };

export function classifyBlobThrown(error: unknown): DeliveryReadFailure {
  const name = error instanceof Error ? error.name : "";
  if (error instanceof BlobStoreSuspendedError || name === "BlobStoreSuspendedError") {
    return failUnavailable("store_suspended");
  }
  if (error instanceof BlobNotFoundError || name === "BlobNotFoundError") {
    return failMissing();
  }
  const message = error instanceof Error ? error.message : "";
  if (/store_suspended/i.test(message) || /has been suspended/i.test(message)) {
    return failUnavailable("store_suspended");
  }
  const status = Number(/Failed to fetch blob:\s*(\d+)/i.exec(message)?.[1] || 0);
  if (status === 404) return failMissing(status);
  if (status === 401 || status === 403) return failUnavailable("blob_forbidden", status);
  if (status >= 500) return failUnavailable("blob_upstream", status);
  if (name === "DeliveryStorageUnconfigured") return failUnavailable("blob_upstream");
  return failUnexpected(status || undefined);
}

export function classifyHttpStatus(status: number): DeliveryReadFailure | { ok: true } {
  if (status === 200 || status === 206) return { ok: true };
  if (status === 404 || status === 410) return failMissing(status);
  if (status === 401 || status === 403) return failUnavailable("blob_forbidden", status);
  if (status >= 500) return failUnavailable("blob_upstream", status);
  return failUnexpected(status);
}

/** Cancela o corpo sem lê-lo. Não chama arrayBuffer, text nem getReader. */
export async function releaseUnreadBody(body: { cancel: () => Promise<void> } | null | undefined): Promise<void> {
  if (body) await body.cancel();
}

function pathsMatch(stored: string, foundUrl: string, pathname: string): boolean {
  const storedPath = blobPathnameFromUrl(stored);
  const foundPath = blobPathnameFromUrl(foundUrl);
  return storedPath === pathname && foundPath === pathname;
}

async function defaultHead(pathname: string): Promise<DeliveryHead | null> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw Object.assign(new Error("Armazenamento de entrega não configurado."), {
      name: "DeliveryStorageUnconfigured",
    });
  }
  const meta = await head(pathname, { token: process.env.BLOB_READ_WRITE_TOKEN });
  return {
    url: meta.url,
    pathname: meta.pathname,
    size: meta.size,
    contentType: meta.contentType,
  };
}

async function defaultRangeStatus(url: string): Promise<number> {
  const headers: Record<string, string> = { Range: "bytes=0-0" };
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    headers.authorization = `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`;
  }
  const response = await fetch(url, { method: "GET", headers, redirect: "manual" });
  await releaseUnreadBody(response.body);
  return response.status;
}

function readerOrDefault(reader?: DeliveryByteReader): DeliveryByteReader {
  return reader ?? { head: defaultHead, rangeStatus: defaultRangeStatus };
}

export async function inspectDeliveryBlob(
  stored: string,
  reader?: DeliveryByteReader
): Promise<DeliveryReadOk | DeliveryReadFailure> {
  if (!isVercelBlobUrl(stored)) return failInvalid();
  const pathname = safeDeliveryPathname(stored);
  if (!pathname) return failInvalid();

  const io = readerOrDefault(reader);
  let meta: DeliveryHead | null;
  try {
    meta = await io.head(pathname);
  } catch (error) {
    return classifyBlobThrown(error);
  }
  if (!meta) return failMissing();
  if (!pathsMatch(stored, meta.url, pathname) || meta.pathname !== pathname) {
    return failInvalid();
  }

  let status: number;
  try {
    status = await io.rangeStatus(meta.url);
  } catch (error) {
    return classifyBlobThrown(error);
  }
  const http = classifyHttpStatus(status);
  if (!http.ok) return http;
  return { ok: true, kind: "blob", pathname };
}

export function resolveDeliveryDownloadTarget(reference: string): DeliveryDownloadTarget {
  const classified = classifyDeliveryStorageReference(reference);
  if (classified.kind === "r2") {
    return { kind: "r2", objectKey: classified.objectKey, mode: "presign_later" };
  }
  if (classified.kind === "vercel_blob") return { kind: "vercel_blob", pathname: classified.pathname };
  if (classified.kind === "local") return { kind: "local" };
  if (/^https?:\/\//i.test(reference.trim())) return { kind: "legacy_https" };
  return { kind: "local_or_missing" };
}

/** Download R2 ainda não está ligado ao cliente. Não assina e não chama a rede. */
export function deliveryR2ReadFailure(): DeliveryReadFailure {
  return failUnavailable("unconfigured");
}

async function defaultR2Head(objectKey: string): Promise<R2DeliveryHeadResult> {
  const headed = await headDeliveryObject(objectKey);
  if (headed.ok) return { ok: true, size: headed.size, contentType: headed.contentType };
  if (headed.code === "unconfigured" || headed.code === "invalid_reference") {
    return { ok: false, code: headed.code };
  }
  if (headed.code === "missing") return { ok: false, httpStatus: 404 };
  if (headed.code === "forbidden") return { ok: false, httpStatus: 403 };
  return { ok: false, httpStatus: 503 };
}

async function readR2Delivery(
  objectKey: string,
  reader?: R2DeliveryReader
): Promise<DeliveryReadOk | DeliveryReadFailure> {
  const io = reader ?? { head: defaultR2Head };
  let result: R2DeliveryHeadResult;
  try {
    result = await io.head(objectKey);
  } catch {
    return failUnexpected();
  }
  if (result.ok) return { ok: true, kind: "r2", pathname: objectKey };
  if ("code" in result) {
    return result.code === "invalid_reference" ? failInvalid() : failUnavailable("unconfigured");
  }
  const http = classifyHttpStatus(result.httpStatus);
  if (!http.ok) return http;
  return { ok: true, kind: "r2", pathname: objectKey };
}

function formatMismatch(extension: DeliveryAudioExtension, format?: DeliveryAudioExtension): boolean {
  return Boolean(format && extension !== format);
}

/**
 * Troca de deliveryAudioUrl sem conclusão. Só a forma da referência.
 * Existência no storage continua obrigatória na conclusão.
 */
export function validateDeliveryFieldReplacement(
  rawUrl: string | null,
  format?: DeliveryAudioExtension | null
): { ok: true } | { ok: false; error: string; httpStatus: 400; code: "invalid" } {
  const urlTrim = String(rawUrl ?? "").trim();
  if (!urlTrim) return { ok: true };
  const classified = classifyDeliveryStorageReference(urlTrim);
  if (classified.kind === "invalid") {
    return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
  }
  if (classified.kind === "local" && !localDeliveryReferenceAllowed()) {
    return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
  }
  if (format && formatMismatch(classified.extension, format)) {
    return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
  }
  return { ok: true };
}

/**
 * Conclusão de serviço. URL https solta é rejeitada.
 * Blob de deliveries só passa com head() e leitura Range 200/206.
 * R2 só passa com reader/head. Sem configuração, a conclusão falha fechada.
 */
export async function validateDeliveryAudioUrl(
  rawUrl: string,
  opts?: { format?: DeliveryAudioExtension; reader?: DeliveryByteReader; r2Reader?: R2DeliveryReader }
): Promise<DeliveryUrlValidationResult> {
  const urlTrim = String(rawUrl || "").trim();
  if (!urlTrim) {
    return { ok: false, error: "URL do áudio não pode estar vazia.", httpStatus: 400, code: "invalid" };
  }
  const classified = classifyDeliveryStorageReference(urlTrim);
  if (classified.kind === "invalid") {
    return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
  }
  if (formatMismatch(classified.extension, opts?.format)) {
    return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
  }
  if (classified.kind === "local") {
    if (!localDeliveryReferenceAllowed()) {
      return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
    }
    return { ok: true, isLocalUpload: true };
  }
  if (classified.kind === "vercel_blob") {
    const inspected = await inspectDeliveryBlob(urlTrim, opts?.reader);
    if (!inspected.ok) {
      return {
        ok: false,
        error: inspected.adminMessage,
        httpStatus: inspected.httpStatus,
        code: inspected.code,
      };
    }
    return { ok: true };
  }
  const inspected = await readR2Delivery(classified.objectKey, opts?.r2Reader);
  if (!inspected.ok) {
    return {
      ok: false,
      error: inspected.adminMessage,
      httpStatus: inspected.httpStatus,
      code: inspected.code,
    };
  }
  return { ok: true };
}

/** Stream oficial depois que a leitura mínima já passou. Não bufferiza o arquivo. */
export async function openDeliveryBlobStream(pathname: string): Promise<
  | { ok: true; stream: ReadableStream<Uint8Array>; contentType: string | null }
  | DeliveryReadFailure
> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return failUnavailable("blob_upstream");
  }
  try {
    const result = await get(pathname, {
      access: "public",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    if (!result || result.statusCode !== 200 || !result.stream) return failMissing();
    return { ok: true, stream: result.stream, contentType: result.blob.contentType || null };
  } catch (error) {
    return classifyBlobThrown(error);
  }
}
