/**
 * Decisão do clique de download. Não baixa bytes e não navega.
 */

export const DELIVERY_DOWNLOAD_UNAVAILABLE =
  "Arquivo temporariamente indisponível. Tente novamente mais tarde.";

const NOT_FOUND = "Arquivo não encontrado.";
const UNAUTHENTICATED = "Não autenticado";
const FORBIDDEN = "Acesso negado";
const GENERIC = "Não foi possível baixar o arquivo. Tente novamente.";

export type ProbeDownloadDecision =
  | { action: "download" }
  | { action: "error"; message: string };

export function probeDownloadDecision(
  status: number,
  body: { ok?: boolean; error?: string } | null | undefined
): ProbeDownloadDecision {
  if (status === 200 && body?.ok === true) return { action: "download" };
  if (status === 503) return { action: "error", message: DELIVERY_DOWNLOAD_UNAVAILABLE };
  if (status === 401) return { action: "error", message: body?.error || UNAUTHENTICATED };
  if (status === 403) return { action: "error", message: body?.error || FORBIDDEN };
  if (status === 404) return { action: "error", message: body?.error || NOT_FOUND };
  return { action: "error", message: body?.error || GENERIC };
}
