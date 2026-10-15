/**
 * Entrada do Dashboard Executivo. Sem rede, sem banco e sem sessão.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { reduceIndependentFetch } from "../src/app/admin/dashboard-ui/useIndependentFetch";

function must(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function main() {
  const empty = reduceIndependentFetch<{ n: number }>(
    { status: "loading", data: null, error: null },
    { type: "start" }
  );
  assert.equal(empty.status, "loading");
  assert.equal(empty.data, null);

  const firstError = reduceIndependentFetch<{ n: number }>(empty, { type: "failure", error: "HTTP 500" });
  assert.equal(firstError.status, "error");
  assert.equal(firstError.data, null);
  assert.equal(firstError.error, "HTTP 500");

  const loaded = reduceIndependentFetch<{ n: number }>(empty, { type: "success", data: { n: 1 } });
  assert.deepEqual(loaded, { status: "success", data: { n: 1 }, error: null });

  const refreshing = reduceIndependentFetch(loaded, { type: "start" });
  assert.deepEqual(refreshing, loaded);

  const replaced = reduceIndependentFetch(refreshing, { type: "success", data: { n: 2 } });
  assert.deepEqual(replaced, { status: "success", data: { n: 2 }, error: null });

  const kept = reduceIndependentFetch(replaced, { type: "failure", error: "HTTP 503" });
  assert.deepEqual(kept, replaced);

  const shell = readFileSync("src/app/admin/AdminShell.tsx", "utf8");
  const layout = readFileSync("src/app/admin/layout.tsx", "utf8");
  const dashboard = readFileSync("src/app/admin/dashboard-ui/ExecutiveDashboard.tsx", "utf8");
  const sync = readFileSync("src/app/lib/synchronization/DomainSyncProvider.tsx", "utf8");

  must(!shell.includes("Verificando permissões"), "shell ainda troca a página inteira pela auth do cliente");
  must(shell.includes('user.role !== "ADMIN"'), "shell deixou de recusar quem não é admin");
  must(shell.includes('router.replace("/")'), "shell deixou o retorno ao site");
  must(shell.includes("useAuth"), "shell deixou o AuthContext");
  must(layout.includes('user.role !== "ADMIN"'), "layout servidor deixou o gate");
  must(layout.includes('redirect("/")'), "layout servidor deixou o redirect");
  must(dashboard.includes("useIndependentFetch"), "dashboard deixou os fetches independentes");
  must(sync.includes("new EventSource"), "sync foi alterado nesta correção");
  must(!shell.includes("DomainSyncProvider"), "shell passou a controlar o SSE");

  console.log("executive-dashboard-fetch-smoke ok");
}

main();
