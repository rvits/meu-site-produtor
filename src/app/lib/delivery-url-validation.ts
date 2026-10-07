/**
 * Nome exibido da entrega. Sem acesso a Blob, token ou rede.
 * A validação que autoriza concluir um serviço está em delivery-storage.ts.
 */

/** Nome amigável a partir do path/URL de entrega (sem expor pasta interna). */
export function deliveryDisplayName(url: string | null | undefined): string {
  if (!url) return "Arquivo entregue";
  try {
    const raw = url.includes("://") ? new URL(url).pathname : url;
    const base = raw.split("/").pop() || "arquivo";
    const cleaned = base.replace(/^[a-f0-9]+_\d+_[a-f0-9]+_/i, "");
    return cleaned || base;
  } catch {
    return "Arquivo entregue";
  }
}
