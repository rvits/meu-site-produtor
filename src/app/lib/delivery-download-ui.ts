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
  | { action: "download"; downloadUrl: string }
  | { action: "error"; message: string };

function isSafeDownloadUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > 4096) return false;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") && !value.includes("\n") && !value.includes("\r")) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function prepareDownloadDecision(
  status: number,
  body: { ok?: boolean; error?: string; downloadUrl?: string } | null | undefined
): ProbeDownloadDecision {
  if (status === 200 && body?.ok === true && isSafeDownloadUrl(body.downloadUrl)) {
    return { action: "download", downloadUrl: body.downloadUrl };
  }
  if (status === 200) return { action: "error", message: GENERIC };
  if (status === 503) return { action: "error", message: DELIVERY_DOWNLOAD_UNAVAILABLE };
  if (status === 401) return { action: "error", message: body?.error || UNAUTHENTICATED };
  if (status === 403) return { action: "error", message: body?.error || FORBIDDEN };
  if (status === 404) return { action: "error", message: body?.error || NOT_FOUND };
  return { action: "error", message: body?.error || GENERIC };
}
