/**
 * Estado atual da conexão SSE no cliente.
 * O interval de recovery deve ler isto, não o `connected` capturado no effect.
 */

export type SyncConnectionEvent = "open" | "error" | "cleanup";

export function nextSyncConnectedFlag(event: SyncConnectionEvent): boolean {
  return event === "open";
}

export function shouldRunFallbackRecovery(input: {
  visible: boolean;
  connectedNow: boolean;
}): boolean {
  return input.visible && !input.connectedNow;
}

export function countFallbackRecoveries(
  ticks: Array<{ visible: boolean; connectedNow: boolean }>
): number {
  return ticks.filter(shouldRunFallbackRecovery).length;
}
