/**
 * P2.2 — recovery de 15s usa o estado atual da conexão, não o closure inicial.
 * Sem banco e sem rede externa.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  countFallbackRecoveries,
  nextSyncConnectedFlag,
  shouldRunFallbackRecovery,
} from "../src/app/lib/synchronization/sse-connection";

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function main() {
  assert.equal(nextSyncConnectedFlag("open"), true);
  assert.equal(nextSyncConnectedFlag("error"), false);
  assert.equal(nextSyncConnectedFlag("cleanup"), false);

  // 1. disconnected → recovery permitido
  assert.equal(shouldRunFallbackRecovery({ visible: true, connectedNow: false }), true);

  // 2. healthy / onopen → interval NÃO dispara
  assert.equal(shouldRunFallbackRecovery({ visible: true, connectedNow: true }), false);

  // 3. volta a false → recovery volta
  assert.equal(shouldRunFallbackRecovery({ visible: true, connectedNow: false }), true);

  // 4. múltiplos ticks healthy → zero recovery
  const healthyMinute = Array.from({ length: 4 }, () => ({
    visible: true,
    connectedNow: true,
  }));
  assert.equal(countFallbackRecoveries(healthyMinute), 0);

  // 5. erro/reconnect: ticks desconectados ainda recuperam
  const reconnectWindow = [
    { visible: true, connectedNow: true },
    { visible: true, connectedNow: false },
    { visible: true, connectedNow: false },
    { visible: true, connectedNow: true },
  ];
  assert.equal(countFallbackRecoveries(reconnectWindow), 2);

  const staleBefore = Array.from({ length: 4 }, () => ({
    visible: true,
    connectedNow: false,
  }));
  assert.equal(countFallbackRecoveries(staleBefore), 4);

  const hiddenHealthy = { visible: false, connectedNow: false };
  assert.equal(shouldRunFallbackRecovery(hiddenHealthy), false);

  const provider = readFileSync("src/app/lib/synchronization/DomainSyncProvider.tsx", "utf8");
  must(provider.includes("connectedRef"), "provider não passou a ler conexão atual via ref");
  must(provider.includes("shouldRunFallbackRecovery"), "interval não usa a decisão extraída");
  must(provider.includes("connectedRef.current"), "interval ainda pode estar no connected de render");
  must(!provider.includes("&& !connected)"), "interval ainda lê `connected` do closure");
  must(provider.includes("15000"), "interval de 15s foi removido");
  must(provider.includes("3000"), "retry 3s foi alterado");
  must(provider.includes("visibilitychange"), "visibilitychange foi removido");
  must(
    provider.includes('document.visibilityState === "visible"') &&
      provider.includes("void recoveryFetch();"),
    "visibilitychange deixou de recuperar ao voltar à aba"
  );
  must(provider.includes("es?.close()"), "connect/cleanup não fecha EventSource anterior");
  must(provider.includes('markConnected("cleanup")'), "cleanup não zera o estado lógico");

  console.log("sse-healthy-recovery-smoke ok");
  console.log("stale_60s_recoveries=" + countFallbackRecoveries(staleBefore));
  console.log("healthy_60s_recoveries=" + countFallbackRecoveries(healthyMinute));
}

main();
