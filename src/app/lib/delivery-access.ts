/**
 * Referência interna de entrega. O cliente só recebe /api/entregas/:id.
 * Três formas coexistem: Blob legado, referência opaca r2: e path local de Development.
 * r2: não é URL e não pode ir para fetch, new URL ou disco.
 */

export type DeliveryAudioExtension = "wav" | "mp3" | "zip";

export type DeliveryReferenceKind = "vercel_blob" | "r2" | "local" | "invalid";

export type ClassifiedDeliveryReference =
  | {
      kind: "vercel_blob";
      reference: string;
      pathname: string;
      extension: DeliveryAudioExtension;
    }
  | {
      kind: "r2";
      reference: string;
      objectKey: string;
      extension: DeliveryAudioExtension;
    }
  | {
      kind: "local";
      reference: string;
      extension: DeliveryAudioExtension;
    }
  | {
      kind: "invalid";
      reason:
        | "empty"
        | "malicious_protocol"
        | "wrong_namespace"
        | "wrong_extension"
        | "unsafe_path"
        | "not_delivery";
    };

const ALLOWED_EXT = new Set<DeliveryAudioExtension>(["wav", "mp3", "zip"]);
const R2_REFERENCE_PREFIX = "r2:deliveries/";
const LOCAL_DELIVERY = /^\/uploads\/deliveries\/[a-zA-Z0-9._-]+$/;

export function deliveryProxyUrl(serviceId: string): string {
  return `/api/entregas/${encodeURIComponent(serviceId)}`;
}

export function isVercelBlobUrl(url: string): boolean {
  return /blob\.vercel-storage\.com/i.test(url);
}

export function isLocalDeliveryPath(url: string): boolean {
  return (
    url.startsWith("/uploads/deliveries/") ||
    url.startsWith("uploads/deliveries/") ||
    url.includes("/uploads/deliveries/")
  );
}

/** Extrai pathname relativo no Blob (ex.: deliveries/foo.wav) a partir da URL completa. */
export function blobPathnameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\//, "");
    return path || null;
  } catch {
    return null;
  }
}

export function deliveryExtension(pathname: string): DeliveryAudioExtension | null {
  const base = pathname.split("/").pop() || "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return null;
  const ext = base.slice(dot + 1).toLowerCase();
  return ALLOWED_EXT.has(ext as DeliveryAudioExtension) ? (ext as DeliveryAudioExtension) : null;
}

/** Pathname de Blob. Rejeita outro namespace, segmento `..` e extensão fora de wav/mp3/zip. */
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

/**
 * Object key de entrega no R2. Recusa a key se a forma canônica for diferente da recebida,
 * para um `%2e%2e` não ser decodificado até passar.
 */
export function acceptedDeliveryObjectKey(key: string): DeliveryAudioExtension | null {
  if (!key.startsWith("deliveries/")) return null;
  if (key.length > 512) return null;
  if (key.includes("\\") || key.includes("\0") || key.includes("%") || key.includes("?") || key.includes("#")) {
    return null;
  }
  try {
    if (decodeURIComponent(key) !== key) return null;
  } catch {
    return null;
  }
  const parts = key.split("/");
  if (parts.some((part) => part.length === 0 || part === "." || part === "..")) return null;
  if (parts.some((part) => !/^[A-Za-z0-9._-]+$/.test(part))) return null;
  return deliveryExtension(key);
}

export function classifyDeliveryStorageReference(raw: string): ClassifiedDeliveryReference {
  const reference = String(raw ?? "").trim();
  if (!reference) return { kind: "invalid", reason: "empty" };
  const lower = reference.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return { kind: "invalid", reason: "malicious_protocol" };
  }
  if (lower.startsWith("r2:")) return classifyR2Reference(reference);
  if (LOCAL_DELIVERY.test(reference)) {
    const extension = deliveryExtension(reference);
    if (!extension) return { kind: "invalid", reason: "wrong_extension" };
    return { kind: "local", reference, extension };
  }
  if (isVercelBlobUrl(reference)) {
    const pathname = safeDeliveryPathname(reference);
    if (!pathname) return { kind: "invalid", reason: "unsafe_path" };
    const extension = deliveryExtension(pathname);
    if (!extension) return { kind: "invalid", reason: "wrong_extension" };
    return { kind: "vercel_blob", reference, pathname, extension };
  }
  return { kind: "invalid", reason: "not_delivery" };
}

function classifyR2Reference(reference: string): ClassifiedDeliveryReference {
  if (!reference.startsWith(R2_REFERENCE_PREFIX)) {
    return { kind: "invalid", reason: "wrong_namespace" };
  }
  const objectKey = reference.slice("r2:".length);
  const extension = acceptedDeliveryObjectKey(objectKey);
  if (!extension) {
    const ext = deliveryExtension(objectKey);
    return { kind: "invalid", reason: ext ? "unsafe_path" : objectKey.startsWith("deliveries/") ? "wrong_extension" : "wrong_namespace" };
  }
  return { kind: "r2", reference, objectKey, extension };
}
