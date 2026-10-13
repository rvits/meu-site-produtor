/**
 * Intenção de download, sem storage e sem segredo.
 * O player usa a URL sem este parâmetro. O download pede attachment.
 */

export type DeliveryDownloadDisposition = "inline" | "attachment";

export function parseDeliveryDisposition(raw: string | null | undefined): DeliveryDownloadDisposition {
  return raw === "attachment" ? "attachment" : "inline";
}

export function withAttachmentDisposition(href: string): string {
  const splitAt = href.indexOf("?");
  const path = splitAt >= 0 ? href.slice(0, splitAt) : href;
  const params = new URLSearchParams(splitAt >= 0 ? href.slice(splitAt + 1) : "");
  params.set("disposition", "attachment");
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
