"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type Check = { key: string; label: string; ok: boolean; detail?: string };
type Timeline = { at: string; step: string; ok: boolean; detail?: string };
type Run = {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  ok: boolean;
  error?: string;
  scenarioId?: string;
  providerPaymentId?: string;
  paymentDbId?: string;
  appointmentIds?: number[];
  couponCodes?: string[];
  refund?: { status: string; reason?: string };
  checks: Check[];
  timeline: Timeline[];
  input: { tipo?: string; planId?: string; runRefund?: boolean };
};

type Scenario = {
  id: string;
  label: string;
  description: string;
  refundOutcome: string | null;
  expectedServiceCoupons: number | null;
};

export default function HomologacaoAdminPage() {
  const [latest, setLatest] = useState<Run | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioId, setScenarioId] = useState("sessao_beat");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [runsRes, scenRes] = await Promise.all([
        fetch("/api/admin/homologation/runs", { cache: "no-store" }),
        fetch("/api/admin/homologation/run", { cache: "no-store" }),
      ]);
      const runsData = await runsRes.json();
      const scenData = await scenRes.json();
      if (runsRes.ok) {
        setLatest(runsData.latest || null);
        setRuns(runsData.runs || []);
      }
      if (scenRes.ok) setScenarios(scenData.scenarios || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runSimulation() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/homologation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenarioId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Falha na simulação.");
        return;
      }
      setLatest(data.run);
      setMessage(data.run.ok ? "Simulação PASS." : "Simulação concluída com falhas — veja checks.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro inesperado.");
    } finally {
      setBusy(false);
    }
  }

  async function refundLatest(outcome: "APPROVED" | "PENDING" | "FAILED" | "TIMEOUT") {
    if (!latest?.providerPaymentId && !latest?.runId) {
      setMessage("Nenhum run para reembolsar.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/homologation/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: latest.runId,
          providerPaymentId: latest.providerPaymentId,
          outcome,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || "Falha no reembolso simulado.");
        return;
      }
      setMessage(`Refund ${data.refund?.status}: ${data.refund?.reason || ""}`);
      if (data.run) setLatest(data.run);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const selected = scenarios.find((s) => s.id === scenarioId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Homologation Engine</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Provider virtual (<code className="text-zinc-300">SimulationProvider</code>) no mesmo
          pipeline de domínio do Asaas — sem cobrança real. Cenários oficiais OP-02B.
        </p>
      </div>

      <div className="rounded-xl border border-amber-600/40 bg-amber-950/20 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-amber-300">Cenários</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs text-zinc-300 block min-w-[220px]">
            Cenário
            <select
              value={scenarioId}
              onChange={(e) => setScenarioId(e.target.value)}
              className="mt-1 w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5"
            >
              {scenarios.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSimulation()}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {busy ? "Executando…" : "Rodar cenário"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void refresh()}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
          >
            Atualizar
          </button>
        </div>
        {selected && <p className="text-xs text-amber-100/80">{selected.description}</p>}
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="text-xs text-zinc-500 self-center">Refund manual:</span>
          {(["APPROVED", "PENDING", "FAILED", "TIMEOUT"] as const).map((o) => (
            <button
              key={o}
              type="button"
              disabled={busy || !latest}
              onClick={() => void refundLatest(o)}
              className="rounded border border-zinc-600 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
            >
              {o}
            </button>
          ))}
        </div>
        {message && <p className="text-sm text-amber-100">{message}</p>}
      </div>

      {loading && <p className="text-zinc-500">Carregando…</p>}

      {latest && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
            <h2 className="text-sm font-semibold text-zinc-100 mb-3">
              Checklist — {latest.runId}{" "}
              {latest.scenarioId && (
                <span className="text-zinc-500 font-normal">({latest.scenarioId})</span>
              )}{" "}
              <span className={latest.ok ? "text-green-400" : "text-red-400"}>
                {latest.ok ? "PASS" : "FAIL"}
              </span>
            </h2>
            <ul className="space-y-2 text-sm">
              {latest.checks.map((c) => (
                <li key={c.key} className="flex gap-2 items-start">
                  <span className={c.ok ? "text-green-400" : "text-zinc-500"}>
                    {c.ok ? "✓" : "○"}
                  </span>
                  <div>
                    <div className="text-zinc-200">{c.label}</div>
                    {c.detail && <div className="text-xs text-zinc-500">{c.detail}</div>}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-4 text-xs text-zinc-500 space-y-1">
              <div>Payment: {latest.providerPaymentId}</div>
              <div>DB: {latest.paymentDbId}</div>
              <div>Appointments: {(latest.appointmentIds || []).join(", ") || "—"}</div>
              <div>Cupons: {(latest.couponCodes || []).join(", ") || "—"}</div>
              {latest.refund && (
                <div>
                  Refund: {latest.refund.status}
                  {latest.refund.reason ? ` — ${latest.refund.reason}` : ""}
                </div>
              )}
              {latest.error && <div className="text-red-400">{latest.error}</div>}
            </div>
            <div className="mt-3 flex gap-3 text-xs">
              <Link href="/minha-conta" className="text-red-400 hover:underline">
                Minha Conta
              </Link>
              <Link href="/admin/agendamentos" className="text-red-400 hover:underline">
                Agendamentos
              </Link>
              <Link href="/admin/estatisticas" className="text-red-400 hover:underline">
                Estatísticas
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
            <h2 className="text-sm font-semibold text-zinc-100 mb-3">Timeline</h2>
            <ol className="space-y-2 max-h-[70vh] overflow-y-auto text-xs">
              {latest.timeline.map((t, i) => (
                <li key={`${t.at}-${i}`} className="border-b border-zinc-800 pb-2">
                  <div className="text-zinc-500">{new Date(t.at).toLocaleString("pt-BR")}</div>
                  <div className={t.ok ? "text-zinc-200" : "text-red-300"}>
                    {t.step}
                    {t.detail ? ` — ${t.detail}` : ""}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}

      {runs.length > 1 && (
        <div className="rounded-xl border border-zinc-700 p-4">
          <h2 className="text-sm font-semibold mb-2">Runs recentes</h2>
          <ul className="text-xs text-zinc-400 space-y-1">
            {runs.slice(0, 10).map((r) => (
              <li key={r.runId}>
                {r.runId} · {r.ok ? "PASS" : "FAIL"} · {r.scenarioId || r.input?.tipo || "?"} ·{" "}
                {new Date(r.startedAt).toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
