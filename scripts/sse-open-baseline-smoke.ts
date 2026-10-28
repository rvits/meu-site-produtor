/**
 * P2 — primeira conexão SSE sem cursor não reproduz histórico.
 * Sem banco, sem rede e sem Production.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  isCursorAfterBaseline,
  resolveRequestedSyncCursor,
  resolveSseOpen,
  selectEventsAfterBaseline,
} from "../src/app/lib/synchronization/sse-open";
import { surfacesForEvent } from "../src/app/lib/synchronization/routing";

type Row = { cursor: string; name: string; surfaces: string[] };

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function replicaOldOpen(history: Row[], take = 100): Row[] {
  return [...history].sort((a, b) => Number(a.cursor) - Number(b.cursor)).slice(0, take);
}

function main() {
  const history: Row[] = Array.from({ length: 120 }, (_, i) => {
    const cursor = String(i + 1);
    return {
      cursor,
      name: "AppointmentReserved",
      surfaces: surfacesForEvent("AppointmentReserved"),
    };
  });
  const latest = history[history.length - 1]!.cursor;

  // TEST 1 — sem cursor + histórico existente
  const open1 = resolveSseOpen({ queryCursor: null, lastEventId: null, latestCursor: latest });
  assert.equal(open1.mode, "baseline_now");
  assert.equal(open1.cursor, latest);
  assert.equal(open1.emitHistorical, false);
  const emitted1 = open1.emitHistorical
    ? replicaOldOpen(history)
    : selectEventsAfterBaseline(history, open1.cursor);
  assert.equal(emitted1.length, 0);
  must(
    replicaOldOpen(history).length === 100,
    "baseline do teste antigo (oldest 100) deixou de representar o bug"
  );

  // TEST 2 — sem cursor + tabela vazia
  const open2 = resolveSseOpen({ queryCursor: null, lastEventId: null, latestCursor: null });
  assert.equal(open2.mode, "empty_wait");
  assert.equal(open2.cursor, null);
  assert.equal(open2.emitHistorical, false);
  const later: Row[] = [{ cursor: "1", name: "AppointmentReserved", surfaces: ["dashboard"] }];
  const captured2 = selectEventsAfterBaseline(later, open2.cursor);
  assert.equal(captured2.length, 1);

  // TEST 3 — query cursor explícito
  const open3 = resolveSseOpen({
    queryCursor: "100",
    lastEventId: null,
    latestCursor: latest,
  });
  assert.equal(open3.mode, "replay_since");
  assert.equal(open3.emitHistorical, true);
  const emitted3 = selectEventsAfterBaseline(history, open3.cursor);
  assert.ok(emitted3.every((row) => Number(row.cursor) > 100));
  assert.equal(emitted3[0]?.cursor, "101");

  // TEST 4 — Last-Event-ID válido (sem query)
  const open4 = resolveSseOpen({
    queryCursor: null,
    lastEventId: "110",
    latestCursor: latest,
  });
  assert.equal(open4.mode, "replay_since");
  assert.equal(open4.cursor, "110");
  const emitted4 = selectEventsAfterBaseline(history, open4.cursor);
  assert.equal(emitted4[0]?.cursor, "111");
  const requested = resolveRequestedSyncCursor({
    queryCursor: "50",
    lastEventId: "110",
  });
  assert.equal(requested, "50");

  // TEST 5 — evento depois do baseline, fora do hub
  const hub: string[] = [];
  const baseline = latest;
  const missed = { cursor: "121", name: "PaymentReceived", surfaces: ["dashboard"] };
  const fromTail = selectEventsAfterBaseline([...history, missed], baseline).filter(
    (row) => !hub.includes(row.cursor)
  );
  assert.equal(fromTail.length, 1);
  assert.equal(fromTail[0]?.cursor, "121");
  assert.equal(isCursorAfterBaseline("120", baseline), false);

  // TEST 6 — primeiro evento novo depois da conexão
  const open6 = resolveSseOpen({
    queryCursor: null,
    lastEventId: null,
    latestCursor: latest,
  });
  const firstNew = { cursor: "121", name: "ServiceStarted", surfaces: ["dashboard"] };
  const live = selectEventsAfterBaseline([firstNew], open6.cursor);
  assert.equal(live.length, 1);
  assert.equal(live[0]?.cursor, "121");

  // TEST 7 — não voltar aos oldest-100 sem cursor
  const after = resolveSseOpen({
    queryCursor: null,
    lastEventId: null,
    latestCursor: latest,
  });
  const historical = after.emitHistorical ? replicaOldOpen(history) : [];
  assert.equal(historical.length, 0);
  assert.notEqual(after.cursor, history[0]?.cursor);
  const invalid = resolveSseOpen({
    queryCursor: "abc",
    lastEventId: "not-a-cursor",
    latestCursor: latest,
  });
  assert.equal(invalid.mode, "baseline_now");
  assert.equal(invalid.emitHistorical, false);

  const beforeFetches = replicaOldOpen(history).filter((row) =>
    row.surfaces.includes("dashboard")
  ).length;
  const afterFetches = emitted1.filter((row) => row.surfaces.includes("dashboard")).length;
  must(beforeFetches === 100, "antes: 100 eventos históricos dashboard");
  must(afterFetches === 0, "depois: zero eventos históricos");

  const route = readFileSync("src/app/api/sync/events/route.ts", "utf8");
  const engine = readFileSync("src/app/lib/synchronization/engine.ts", "utf8");
  const provider = readFileSync("src/app/lib/synchronization/DomainSyncProvider.tsx", "utf8");
  const pollBlock = route.slice(0, route.indexOf("const encoder"));
  must(pollBlock.includes('mode === "poll"'), "poll JSON ausente");
  must(pollBlock.includes("listSyncEventsSince"), "poll deixou de usar listSyncEventsSince");
  must(route.includes("resolveSseOpen"), "SSE não aplica a política de baseline");
  must(route.includes("getLatestSyncCursor"), "SSE não lê o latest para baseline");
  must(
    route.includes("startedEmpty"),
    "tabela vazia não tem caminho de espera"
  );
  must(
    provider.includes("15000"),
    " DomínioSync 15s foi alterado nesta correção"
  );
  must(
    engine.includes("orderBy: { cursor: \"asc\" }"),
    "engine listSyncEventsSince mudou a ordenação"
  );

  console.log("sse-open-baseline-smoke ok");
  console.log("before_historical_dashboard=" + beforeFetches);
  console.log("after_historical_dashboard=" + afterFetches);
}

main();
