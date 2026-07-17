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
  providerPaymentId?: string;
  paymentDbId?: string;
  appointmentIds?: number[];
  couponCodes?: string[];
  refund?: { status: string; reason?: string };
  checks: Check[];
  timeline: Timeline[];
  input: { tipo?: string; planId?: string; runRefund?: boolean };
};

export default function HomologacaoAdminPage() {
  const [latest, setLatest] = useState<Run | null>(null);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tipo, setTipo] = useState<"agendamento" | "plano">("agendamento");
  const [planId, setPlanId] = useState("bronze");
  const [runRefund, setRunRefund] = useState(false);
  const [multi, setMulti] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/homologation/runs", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) {
        setLatest(data.latest || null);
        setRuns(data.runs || []);
      }
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
      const body: Record<string, unknown> = {
        tipo,
        runRefund,
      };
      if (tipo === "plano") {
        body.planId = planId;
        body.modo = "mensal";
      } else if (multi) {
        body.servicos = [
          { id: "sessao", nome: "Sessão", quantidade: 1 },
          { id: "mix", nome: "Mixagem", quantidade: 1 },
        ];
        body.beats = [{ id: "beat1", nome: "1 Beat", quantidade: 1 }];
      } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const data = tomorrow.toISOString().slice(0, 10);
        body.servicos = [{ id: "sessao", nome: "Sessão", quantidade: 1 }];
        body.data = data;
        body.hora = "14:00";
      }

      const res = await fetch("/api/admin/homologation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  async function refundLatest() {
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-100">Homologation Engine</h1>
        <p className="text-sm text-zinc-400 mt-1">
          Provider virtual (<code className="text-zinc-300">SimulationProvider</code>) no mesmo
          pipeline de domínio do Asaas — sem cobrança real. Use antes do Go Live.
        </p>
      </div>

      <div className="rounded-xl border border-amber-600/40 bg-amber-950/20 p-4 space-y-3">
        <h2 className="text-sm font-semibold text-amber-300">Simulação gratuita</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-xs text-zinc-300">
            Tipo
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "agendamento" | "plano")}
              className="ml-2 rounded border border-zinc-600 bg-zinc-900 px-2 py-1"
            >
              <option value="agendamento">Agendamento</option>
              <option value="plano">Plano</option>
            </select>
          </label>
          {tipo === "plano" && (
            <label className="text-xs text-zinc-300">
              Plano
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="ml-2 rounded border border-zinc-600 bg-zinc-900 px-2 py-1"
              >
                <option value="bronze">Bronze</option>
                <option value="prata">Prata</option>
                <option value="ouro">Ouro</option>
              </select>
            </label>
          )}
          {tipo === "agendamento" && (
            <label className="text-xs text-zinc-300 flex items-center gap-2">
              <input
                type="checkbox"
                checked={multi}
                onChange={(e) => setMulti(e.target.checked)}
              />
              Multi (Sessão + Mix + Beat → cupons)
            </label>
          )}
          <label className="text-xs text-zinc-300 flex items-center gap-2">
            <input
              type="checkbox"
              checked={runRefund}
              onChange={(e) => setRunRefund(e.target.checked)}
            />
            Incluir reembolso simulado
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runSimulation()}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {busy ? "Executando…" : "Rodar simulação gratuita"}
          </button>
          <button
            type="button"
            disabled={busy || !latest}
            onClick={() => void refundLatest()}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-50"
          >
            Reembolsar último run
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
        {message && <p className="text-sm text-amber-100">{message}</p>}
      </div>

      {loading && <p className="text-zinc-500">Carregando…</p>}

      {latest && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-700 bg-zinc-900/50 p-4">
            <h2 className="text-sm font-semibold text-zinc-100 mb-3">
              Checklist — {latest.runId}{" "}
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
                {r.runId} · {r.ok ? "PASS" : "FAIL"} · {r.input?.tipo || "?"} ·{" "}
                {new Date(r.startedAt).toLocaleString("pt-BR")}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
