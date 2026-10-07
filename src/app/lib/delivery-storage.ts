/**
 * Leitura e validação de entregas no store de deliveries.
 * Metadata + no máximo 1 byte. O corpo nunca é acumulado em Buffer.
 * A troca futura de provedor entra por DeliveryByteReader, sem mudar a state machine.
 */
import {
  BlobNotFoundError,
  BlobStoreSuspendedError,
  get,
  head,
} from "@vercel/blob";
import { blobPathnameFromUrl, isLocalDeliveryPath, isVercelBlobUrl } from "./delivery-access";

if (typeof window !== "undefined") {
  throw new Error("delivery-storage só pode ser usado no servidor.");
}

export const DELIVERY_NOT_FOUND = "Arquivo não encontrado.";
export const DELIVERY_UNAVAILABLE =
  "Arquivo temporariamente indisponível. Tente novamente mais tarde.";
export const DELIVERY_STORAGE_BLOCK =
  "Não foi possível validar o arquivo de entrega porque o armazenamento está temporariamente indisponível. Tente novamente mais tarde.";
export const DELIVERY_INVALID = "Faça upload do arquivo (WAV/MP3/ZIP). Caminho inválido.";

const ALLOWED_EXT = new Set(["wav", "mp3", "zip"]);

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
  | "blob_unexpected";

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
  kind: "local" | "blob";
  pathname: string | null;
};

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

export function deliveryExtension(pathname: string): string | null {
  const base = pathname.split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  return ALLOWED_EXT.has(ext) ? ext : null;
}

/** Pathname de entrega. Rejeita outro namespace, segmento `..` e extensão fora de wav/mp3/zip. */
export function safeDeliveryPathname(url: string): string | null {
  const raw = blobPathnameFromUrl(url);
  if (!raw) return null;
  let path = raw;
  try {
    path = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (path.includes("\\") || path.includes("\0")) return null;
  const parts = path.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) return null;
  if (!path.startsWith("deliveries/")) return null;
  if (!deliveryExtension(path)) return null;
  return path;
}

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

/**
 * Conclusão de serviço. URL https solta é rejeitada.
 * Blob de deliveries só passa com head() e leitura Range 200/206.
 */
export async function validateDeliveryAudioUrl(
  rawUrl: string,
  opts?: { format?: "wav" | "mp3" | "zip"; reader?: DeliveryByteReader }
): Promise<DeliveryUrlValidationResult> {
  const urlTrim = String(rawUrl || "").trim();
  if (!urlTrim) {
    return { ok: false, error: "URL do áudio não pode estar vazia.", httpStatus: 400, code: "invalid" };
  }
  const lower = urlTrim.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
  }
  if (isLocalDeliveryPath(urlTrim) && /^\/uploads\/deliveries\/[a-zA-Z0-9._-]+$/.test(urlTrim)) {
    if (!localDeliveryReferenceAllowed()) {
      return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
    }
    const ext = deliveryExtension(urlTrim);
    if (!ext || (opts?.format && ext !== opts.format)) {
      return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
    }
    return { ok: true, isLocalUpload: true };
  }
  if (!isVercelBlobUrl(urlTrim)) {
    return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
  }
  const pathname = safeDeliveryPathname(urlTrim);
  if (!pathname) {
    return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
  }
  const ext = deliveryExtension(pathname);
  if (opts?.format && ext !== opts.format) {
    return { ok: false, error: DELIVERY_INVALID, httpStatus: 400, code: "invalid" };
  }
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
