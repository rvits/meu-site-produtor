"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Appointment {
  id: number;
  data: string;
  status: string;
  tipo: string;
}

interface Service {
  id: string;
  tipo: string;
  description?: string;
  status: string;
  appointmentId: number | null;
  appointment: Appointment | null;
  deliveryAudioUrl?: string | null;
  deliveryAudioFormat?: string | null;
  user: {
    nomeArtistico: string;
    email: string;
  };
  createdAt: string;
}

type GroupKey = string;

export default function AdminServicosSelecionadosPage() {
  const [servicos, setServicos] = useState<Service[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [concluirModal, setConcluirModal] = useState<{
    id: string;
    tipo: string;
    audioUrl: string;
    formato: "wav" | "mp3";
  } | null>(null);

  useEffect(() => {
    carregarServicos();
  }, []);

  async function carregarServicos() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/servicos");
      if (res.ok) {
        const data = await res.json();
        const comAgendamento = (data.servicos || []).filter(
          (s: Service) => s.appointmentId != null
        );
        setServicos(comAgendamento);
      }
    } catch (err) {
      console.error("Erro ao carregar serviços", err);
    } finally {
      setLoading(false);
    }
  }

  function abrirModalConcluir(s: Service) {
    setConcluirModal({
      id: s.id,
      tipo: s.tipo,
      audioUrl: s.deliveryAudioUrl || "",
      formato: (s.deliveryAudioFormat === "mp3" ? "mp3" : "wav"),
    });
  }

  async function confirmarConcluir() {
    if (!concluirModal) return;
    const url = concluirModal.audioUrl.trim();
    if (!url) {
      alert("Informe a URL do arquivo de áudio (link público para download).");
      return;
    }
    try {
      setUpdatingId(concluirModal.id);
      const res = await fetch(`/api/admin/servicos?id=${concluirModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "concluido",
          deliveryAudioUrl: url,
          deliveryAudioFormat: concluirModal.formato,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setConcluirModal(null);
        await carregarServicos();
      } else {
        alert(data.error || "Erro ao concluir. Verifique URL e formato.");
      }
    } catch (err) {
      console.error("Erro ao atualizar serviço", err);
      alert("Erro ao atualizar serviço.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function marcarComoPendente(id: string) {
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/admin/servicos?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "aceito" }),
      });
      if (res.ok) await carregarServicos();
      else alert("Erro ao atualizar. Tente novamente.");
    } catch (err) {
      console.error("Erro ao atualizar serviço", err);
      alert("Erro ao atualizar serviço.");
    } finally {
      setUpdatingId(null);
    }
  }

  const filtrados = busca.trim()
    ? servicos.filter(
        (s) =>
          s.user.nomeArtistico.toLowerCase().includes(busca.toLowerCase()) ||
          s.user.email.toLowerCase().includes(busca.toLowerCase()) ||
          (s.appointment?.id && String(s.appointment.id).includes(busca))
      )
    : servicos;

  const grupos = filtrados.reduce<Record<GroupKey, Service[]>>((acc, s) => {
    const key: GroupKey =
      s.appointmentId != null ? `ag-${s.appointmentId}` : "sem-agendamento";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const gruposOrdenados = Object.entries(grupos).sort(([, a], [, b]) => {
    const headOf = (arr: Service[]) =>
      [...arr].sort((x, y) => x.id.localeCompare(y.id))[0];
    const dataA = headOf(a)?.appointment?.data;
    const dataB = headOf(b)?.appointment?.data;
    if (!dataA || !dataB) return 0;
    return new Date(dataB).getTime() - new Date(dataA).getTime();
  });

  if (loading) {
    return (
      <p className="text-zinc-400">Carregando serviços selecionados...</p>
    );
  }

  async function atualizarLista() {
    setRefreshing(true);
    await carregarServicos();
    setRefreshing(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">
            Serviços Selecionados
          </h1>
          <p className="text-zinc-400">
            Ao concluir, informe o link público do arquivo (WAV ou MP3). O cliente verá o download na Minha Conta.
          </p>
        </div>
        <button
          type="button"
          onClick={atualizarLista}
          disabled={refreshing || loading}
          className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
        >
          {refreshing ? "Atualizando..." : "Atualizar"}
        </button>
      </div>

      {concluirModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-600 bg-zinc-900 p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-bold text-zinc-100">Concluir serviço</h2>
            <p className="text-sm text-zinc-400">
              Serviço: <span className="text-zinc-200">{concluirModal.tipo}</span>
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                URL do arquivo (link direto ou página de download)
              </label>
              <input
                type="url"
                value={concluirModal.audioUrl}
                onChange={(e) =>
                  setConcluirModal((m) => (m ? { ...m, audioUrl: e.target.value } : null))
                }
                placeholder="https://..."
                className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Formato</label>
              <select
                value={concluirModal.formato}
                onChange={(e) =>
                  setConcluirModal((m) =>
                    m ? { ...m, formato: e.target.value as "wav" | "mp3" } : null
                  )
                }
                className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-sm text-zinc-100"
              >
                <option value="wav">WAV</option>
                <option value="mp3">MP3</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConcluirModal(null)}
                className="rounded-lg border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmarConcluir}
                disabled={updatingId === concluirModal.id}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
              >
                {updatingId === concluirModal.id ? "Salvando..." : "Concluir"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, email ou ID do agendamento..."
          className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
        />
        {busca && (
          <p className="mt-2 text-sm text-zinc-400">
            {filtrados.length} serviço(s) encontrado(s)
          </p>
        )}
      </div>

      {gruposOrdenados.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhum serviço selecionado vinculado a agendamento. Os serviços
          aparecem aqui quando o cliente agenda (com cupom ou pagamento) e
          escolhe os serviços.
        </div>
      ) : (
        <div className="space-y-6">
          {gruposOrdenados.map(([key, items]) => {
            const sorted = [...items].sort((x, y) => x.id.localeCompare(y.id));
            const head = sorted[0];
            const apt = head?.appointment;
            const agendamentoId = head?.appointmentId;
            const user = head?.user;
            const pendentes = items.filter(
              (s) =>
                s.status !== "concluido" &&
                s.status !== "cancelado" &&
                s.status !== "recusado"
            );
            const feitos = items.filter((s) => s.status === "concluido");

            return (
              <div
                key={key}
                className="rounded-xl border border-zinc-700 bg-zinc-800/50 overflow-hidden"
              >
                <div className="p-4 bg-zinc-900/80 border-b border-zinc-700 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs text-zinc-500">Agendamento #</span>
                    {agendamentoId != null && (
                      <Link
                        href={`/admin/agendamentos?highlight=${agendamentoId}`}
                        className="font-mono text-red-400 hover:underline ml-1"
                      >
                        {agendamentoId}
                      </Link>
                    )}
                    {apt?.data && (
                      <span className="text-zinc-300 ml-2">
                        {new Date(apt.data).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    )}
                    <span className="ml-2 text-xs text-zinc-500">
                      {apt?.tipo || "—"} · {apt?.status}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-zinc-500">Cliente:</span>
                    <div className="font-medium text-zinc-100">
                      {user?.nomeArtistico}
                    </div>
                    <div className="text-xs text-zinc-400">{user?.email}</div>
                  </div>
                </div>

                <div className="p-4 space-y-3">
                  {items.map((s) => {
                    const isFeito = s.status === "concluido";
                    const isCanceladoOuRecusado =
                      s.status === "cancelado" || s.status === "recusado";

                    return (
                      <div
                        key={s.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 py-2 border-b border-zinc-700/50 last:border-0"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`inline-block w-2 h-2 rounded-full ${
                                isFeito
                                  ? "bg-green-500"
                                  : isCanceladoOuRecusado
                                    ? "bg-red-500"
                                    : "bg-amber-500"
                              }`}
                            />
                            <span className="font-medium text-zinc-200">
                              {s.tipo}
                            </span>
                            {s.description && (
                              <span className="text-zinc-400 text-sm truncate">
                                — {s.description}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {isFeito
                              ? s.deliveryAudioUrl
                                ? `Feito · ${(s.deliveryAudioFormat || "").toUpperCase()} · link registrado`
                                : "Feito"
                              : isCanceladoOuRecusado
                                ? s.status === "cancelado"
                                  ? "Cancelado (agendamento cancelado)"
                                  : "Recusado"
                                : "A fazer"}
                          </div>
                          {isFeito && s.deliveryAudioUrl && (
                            <p className="text-xs text-zinc-600 truncate mt-1">
                              {s.deliveryAudioUrl}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex flex-wrap gap-2">
                          {!isFeito && !isCanceladoOuRecusado && (
                            <button
                              type="button"
                              onClick={() => abrirModalConcluir(s)}
                              disabled={updatingId === s.id}
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition disabled:opacity-50"
                            >
                              Concluir com entrega
                            </button>
                          )}
                          {isFeito && (
                            <button
                              type="button"
                              onClick={() => marcarComoPendente(s.id)}
                              disabled={updatingId === s.id}
                              className="rounded-lg bg-zinc-600 px-4 py-2 text-sm font-semibold text-zinc-200 hover:bg-zinc-500 transition disabled:opacity-50"
                            >
                              {updatingId === s.id
                                ? "Salvando..."
                                : "Reabrir (a fazer)"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-4 py-2 bg-zinc-900/50 text-xs text-zinc-500 flex justify-between">
                  <span>
                    A fazer: {pendentes.length} · Feitos: {feitos.length}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
