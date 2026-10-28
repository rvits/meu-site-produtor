/**
 * Política de abertura SSE: primeira conexão sem cursor parte do agora.
 * Reconnect com cursor continua recuperando eventos posteriores.
 */

export type SseOpenMode = "replay_since" | "baseline_now" | "empty_wait";

export type SseOpenDecision = {
  mode: SseOpenMode;
  /** Limite exclusivo (cursor > bound). Null só em tabela vazia. */
  cursor: string | null;
  emitHistorical: boolean;
};

export function normalizeSyncCursor(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  return /^\d+$/.test(trimmed) ? trimmed : null;
}

/**
 * query ?cursor= tem prioridade sobre Last-Event-ID, igual ao GET /api/sync/events.
 */
export function resolveRequestedSyncCursor(input: {
  queryCursor?: string | null;
  lastEventId?: string | null;
}): string | null {
  return normalizeSyncCursor(input.queryCursor) ?? normalizeSyncCursor(input.lastEventId);
}

export function resolveSseOpen(input: {
  queryCursor?: string | null;
  lastEventId?: string | null;
  latestCursor: string | null;
}): SseOpenDecision {
  const requested = resolveRequestedSyncCursor(input);
  if (requested) {
    return { mode: "replay_since", cursor: requested, emitHistorical: true };
  }
  const latest = normalizeSyncCursor(input.latestCursor);
  if (latest) {
    return { mode: "baseline_now", cursor: latest, emitHistorical: false };
  }
  return { mode: "empty_wait", cursor: null, emitHistorical: false };
}

export function isCursorAfterBaseline(
  eventCursor: string | null | undefined,
  baseline: string | null
): boolean {
  const event = normalizeSyncCursor(eventCursor);
  if (!event) return false;
  if (baseline == null) return true;
  try {
    return BigInt(event) > BigInt(baseline);
  } catch {
    return false;
  }
}

/**
 * Eventos que o SSE deve emitir no catch-up/tail após o open.
 * Nunca inclui o próprio baseline nem cursores anteriores.
 */
export function selectEventsAfterBaseline<T extends { cursor: string }>(
  events: T[],
  baseline: string | null
): T[] {
  return events.filter((event) => isCursorAfterBaseline(event.cursor, baseline));
}
