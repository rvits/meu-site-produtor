const APP_DATA_CHANGED = "thouse:data-changed";

/** Dispara refresh em telas que assinam `subscribeAppDataChanged`. */
export function notifyAppDataChanged(detail?: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_DATA_CHANGED, { detail }));
}

/** Assina mudanças de dados + refresh ao voltar à aba. */
export function subscribeAppDataChanged(onRefresh: () => void): () => void {
  if (typeof window === "undefined") return () => {};

  const handler = () => onRefresh();
  window.addEventListener(APP_DATA_CHANGED, handler);

  const onVisibility = () => {
    if (document.visibilityState === "visible") onRefresh();
  };
  document.addEventListener("visibilitychange", onVisibility);

  return () => {
    window.removeEventListener(APP_DATA_CHANGED, handler);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}

export function isLocalhostClient(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1";
}
