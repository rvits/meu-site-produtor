/**
 * Nome de entrega para UI e Content-Disposition.
 * Não autoriza acesso, não escolhe key R2 e não é caminho de arquivo.
 */

import { deliveryDisplayName } from "@/app/lib/delivery-url-validation";
import { serviceOrderLabel } from "@/app/lib/ui/service-order-visual";

export type DeliveryNameExtension = "wav" | "mp3" | "zip";

const MAX_NAME_LENGTH = 120;
const UUID_TEXT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function extensionOf(format?: string | null, url?: string | null): DeliveryNameExtension | null {
  const fmt = String(format || "").trim().toLowerCase();
  if (fmt === "wav" || fmt === "mp3" || fmt === "zip") return fmt;
  const fromUrl = /\.(wav|mp3|zip)$/i.exec(deliveryDisplayName(url));
  if (!fromUrl) return null;
  const ext = fromUrl[1].toLowerCase();
  if (ext === "wav" || ext === "mp3" || ext === "zip") return ext;
  return null;
}

function looksTechnical(name: string): boolean {
  const stem = name.replace(/\.(wav|mp3|zip)$/i, "");
  return UUID_TEXT.test(name) || UUID_TEXT.test(stem);
}

function withCoherentExtension(stem: string, extension: DeliveryNameExtension): string {
  const suffix = `.${extension}`;
  const maxStem = MAX_NAME_LENGTH - suffix.length;
  const cut = stem.slice(0, Math.max(1, maxStem)).replace(/[. ]+$/g, "").trim() || "entrega";
  return `${cut}${suffix}`;
}

/**
 * Basename sanitizado, com a extensão real do arquivo.
 * O resultado não contém path, controle ou quebra de linha.
 */
export function sanitizeDeliveryOriginalName(raw: string, extension: DeliveryNameExtension): string {
  const base = String(raw || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part.length > 0)
    .pop() || "";
  const cleaned = base
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, "")
    .replace(/^\.+/, "")
    .trim();
  const withoutExt = cleaned.replace(/\.(wav|mp3|zip)$/i, "").replace(/[. ]+$/g, "").trim();
  const stem = !withoutExt || withoutExt === "." || withoutExt === ".." ? "entrega" : withoutExt;
  return withCoherentExtension(stem, extension);
}

export function deliveryPresentedName(input: {
  originalName?: string | null;
  tipo?: string | null;
  format?: string | null;
  url?: string | null;
}): string {
  const stored = String(input.originalName || "")
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, "")
    .trim();
  if (stored && !stored.includes("/") && !stored.includes("\\") && !stored.includes("..") && !looksTechnical(stored)) {
    return stored;
  }
  const fromUrl = deliveryDisplayName(input.url);
  if (fromUrl && fromUrl !== "Arquivo entregue" && !looksTechnical(fromUrl)) return fromUrl;
  const ext = extensionOf(input.format, input.url);
  const tipo = String(input.tipo || "").trim();
  if (!tipo) return ext ? `Entrega.${ext}` : "Arquivo entregue";
  const label = serviceOrderLabel(tipo).split(" (")[0] || "Entrega";
  return ext ? `${label}.${ext}` : label;
}

/** Header único. filename* carrega Unicode; o parâmetro ASCII não aceita aspas nem controle. */
export function contentDispositionAttachment(fileName: string): string {
  return contentDisposition("attachment", fileName);
}

export function contentDispositionInline(fileName: string): string {
  return contentDisposition("inline", fileName);
}

function contentDisposition(kind: "inline" | "attachment", fileName: string): string {
  const cleaned = String(fileName || "")
    .replace(/[\u0000-\u001F\u007F\u2028\u2029]/g, "")
    .replace(/[\\/]/g, "")
    .trim() || "entrega";
  const ascii = cleaned.replace(/[^\x20-\x7E]/g, "_").replace(/["\\;]/g, "").trim() || "entrega";
  const star = encodeURIComponent(cleaned).replace(/['()*]/g, (char) => {
    return `%${char.charCodeAt(0).toString(16).toUpperCase()}`;
  });
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${star}`;
}
