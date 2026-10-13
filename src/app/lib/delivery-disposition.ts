/**
 * Intenção de download, sem storage e sem segredo.
 * O player usa a URL sem estes parâmetros.
 * download=prepare pede o JSON com a URL assinada. disposition=attachment
 * continua válido para o proxy legado, quando o prepare o devolve.
 */

export type DeliveryDownloadDisposition = "inline" | "attachment";

export function parseDeliveryDisposition(raw: string | null | undefined): DeliveryDownloadDisposition {
  return raw === "attachment" ? "attachment" : "inline";
}

export function isPrepareDownload(raw: string | null | undefined): boolean {
  return raw === "prepare";
}

/** Same-origin. Não inclui key, filename nem URL assinada. */
export function withPrepareDownload(href: string): string {
  const splitAt = href.indexOf("?");
  const path = splitAt >= 0 ? href.slice(0, splitAt) : href;
  const params = new URLSearchParams(splitAt >= 0 ? href.slice(splitAt + 1) : "");
  params.delete("disposition");
  params.set("download", "prepare");
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

export function withAttachmentDisposition(href: string): string {
  const splitAt = href.indexOf("?");
  const path = splitAt >= 0 ? href.slice(0, splitAt) : href;
  const params = new URLSearchParams(splitAt >= 0 ? href.slice(splitAt + 1) : "");
  params.set("disposition", "attachment");
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
