const URL_OK = /^https?:\/\/.+/i;

export type DeliveryUrlValidationResult =
  | { ok: true; probeOk?: boolean; probeSkippedReason?: string }
  | { ok: false; error: string };

/**
 * Valida URL de entrega de áudio. Probe HEAD opcional (vários hosts retornam 405 — não falhamos por isso).
 */
export async function validateDeliveryAudioUrl(
  rawUrl: string,
  opts?: { probe?: boolean }
): Promise<DeliveryUrlValidationResult> {
  const urlTrim = String(rawUrl || "").trim();
  if (!urlTrim) {
    return { ok: false, error: "URL do áudio não pode estar vazia." };
  }
  const lower = urlTrim.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:") || lower.startsWith("vbscript:")) {
    return { ok: false, error: "URL inválida: apenas links http ou https são permitidos." };
  }
  if (!URL_OK.test(urlTrim)) {
    return { ok: false, error: "Informe uma URL http(s) válida." };
  }

  if (!opts?.probe) {
    return { ok: true };
  }

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(urlTrim, {
      method: "HEAD",
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "User-Agent": "THouseRec-DeliveryCheck/1.0" },
    });
    clearTimeout(timer);

    if (res.status === 404) {
      return { ok: false, error: "O link não foi encontrado (404). Verifique se o arquivo está disponível." };
    }

    if (res.ok || res.status === 405 || res.status === 403 || res.status === 401) {
      return {
        ok: true,
        probeOk: res.ok,
        probeSkippedReason:
          !res.ok && res.status !== 404
            ? `HEAD retornou ${res.status} (aceito como inconclusivo)`
            : undefined,
      };
    }

    return {
      ok: true,
      probeOk: false,
      probeSkippedReason: `HEAD retornou ${res.status}; formato da URL aceito`,
    };
  } catch (e: any) {
    const aborted = e?.name === "AbortError";
    return {
      ok: true,
      probeOk: false,
      probeSkippedReason: aborted
        ? "Tempo esgotado ao verificar o link (HEAD)"
        : "Não foi possível verificar o link (HEAD); formato aceito",
    };
  }
}
