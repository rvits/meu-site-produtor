"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ACTIVE_OPERATIONAL_SERVICE_STATUSES } from "@/app/lib/service-authority";
import { notifyAppDataChanged } from "@/app/lib/app-data-events";
import { useDomainRefresh } from "@/app/hooks/useDomainRefresh";
import { deliveryDisplayName } from "@/app/lib/delivery-url-validation";

const ACTIVE_SERVICE_STATUSES = ACTIVE_OPERATIONAL_SERVICE_STATUSES;

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
    formato: "wav" | "mp3" | "zip";
    fileName?: string;
    uploading?: boolean;
  } | null>(null);

  const carregarServicos = useCallback(async (withRepair = false) => {
    try {
      if (withRepair) setLoading(true);
      const url = withRepair ? "/api/admin/servicos?repair=1" : "/api/admin/servicos";
      const res = await fetch(url, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const data = await res.json();
        const comAgendamento = (data.servicos || []).filter(
          (s: Service) =>
            s.appointmentId != null && ACTIVE_SERVICE_STATUSES.has(s.status)
        );
        setServicos(comAgendamento);
      }
    } catch (err) {
      console.error("Erro ao carregar serviços", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useDomainRefresh("servicos-selecionados", () => carregarServicos(false));

  useEffect(() => {
    void carregarServicos(true);
  }, [carregarServicos]);

  function abrirModalConcluir(s: Service) {
    setConcluirModal({
      id: s.id,
      tipo: s.tipo,
      audioUrl: s.deliveryAudioUrl || "",
      formato: (s.deliveryAudioFormat === "mp3" ? "mp3" : s.deliveryAudioFormat === "zip" ? "zip" : "wav"),
    });
  }

  async function onSelectDeliveryFile(file: File | null) {
    if (!concluirModal || !file) return;
    setConcluirModal((m) => (m ? { ...m, uploading: true } : null));
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("serviceId", concluirModal.id);
      const res = await fetch("/api/admin/servicos/upload-entrega", {
        method: "POST",
        body,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "Falha no upload.");
        return;
      }
      setConcluirModal((m) =>
        m
          ? {
              ...m,
              audioUrl: data.deliveryAudioUrl,
              formato: data.deliveryAudioFormat || m.formato,
              fileName: data.fileName || file.name,
              uploading: false,
            }
          : null
      );
    } catch (e) {
      console.error(e);
      alert("Erro no upload.");
    } finally {
      setConcluirModal((m) => (m ? { ...m, uploading: false } : null));
    }
  }

  async function confirmarConcluir() {
    if (!concluirModal) return;
    const url = concluirModal.audioUrl.trim();
    if (!url) {
      alert("Selecione e faça upload de um arquivo (WAV/MP3/ZIP) antes de salvar.");
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
        notifyAppDataChanged("admin-servico-updated");
      } else {
        alert(data.error || "Erro ao concluir. Verifique o arquivo.");
      }
    } catch (err) {
      console.error("Erro ao atualizar serviço", err);
      alert("Erro ao atualizar serviço.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function iniciarServico(id: string) {
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/admin/servicos?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "em_andamento" }),
      });
      if (res.ok) {
        await carregarServicos();
        notifyAppDataChanged("admin-servico-updated");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao iniciar serviço.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao iniciar serviço.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function aceitarServico(id: string) {
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/admin/servicos?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "aceito" }),
      });
      if (res.ok) {
        await carregarServicos();
        notifyAppDataChanged("admin-servico-updated");
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Erro ao aceitar serviço.");
      }
    } catch (err) {
      console.error(err);
      alert("Erro ao aceitar serviço.");
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
            Colunas: Pendentes · Aceitos · Em andamento. Conclusão com upload de arquivo (WAV/MP3/ZIP).
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
            <h2 className="text-lg font-bold text-zinc-100">Entregar arquivo</h2>
            <p className="text-sm text-zinc-400">
              Serviço: <span className="text-zinc-200">{concluirModal.tipo}</span>
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Selecionar arquivo (WAV, MP3 ou ZIP)
              </label>
              <input
                type="file"
                accept=".wav,.mp3,.zip,audio/wav,audio/mpeg,application/zip"
                onChange={(e) => void onSelectDeliveryFile(e.target.files?.[0] || null)}
                className="w-full text-sm text-zinc-300"
              />
              {concluirModal.uploading && (
                <p className="text-xs text-amber-400 mt-1">Enviando arquivo…</p>
              )}
              {concluirModal.fileName && (
                <p className="text-xs text-green-400 mt-1">Arquivo: {concluirModal.fileName}</p>
              )}
            </div>
            {concluirModal.audioUrl && concluirModal.fileName && (
              <p className="text-xs text-zinc-400">Pronto para salvar: {concluirModal.fileName}</p>
            )}
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
                disabled={updatingId === concluirModal.id || concluirModal.uploading || !concluirModal.audioUrl}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
              >
                {updatingId === concluirModal.id ? "Salvando..." : "Salvar entrega"}
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

                <div className="p-4 grid gap-4 md:grid-cols-3">
                  {(
                    [
                      { key: "pendente", label: "Pendentes", color: "text-amber-300" },
                      { key: "aceito", label: "Aceitos", color: "text-green-300" },
                      { key: "em_andamento", label: "Em andamento", color: "text-blue-300" },
                    ] as const
                  ).map((col) => {
                    const colItems = items.filter((s) => s.status === col.key);
                    return (
                      <div key={col.key} className="rounded-lg border border-zinc-700/80 bg-zinc-900/40 p-3">
                        <h3 className={`text-xs font-semibold uppercase tracking-wide mb-3 ${col.color}`}>
                          {col.label} ({colItems.length})
                        </h3>
                        <div className="space-y-3">
                          {colItems.length === 0 ? (
                            <p className="text-xs text-zinc-600">—</p>
                          ) : (
                            colItems.map((s) => (
                              <div
                                key={s.id}
                                className="rounded border border-zinc-700/60 bg-zinc-800/50 p-3 space-y-2"
                              >
                                <div className="font-medium text-zinc-200">{s.tipo}</div>
                                {s.description && (
                                  <div className="text-xs text-zinc-400">{s.description}</div>
                                )}
                                {s.deliveryAudioUrl && (
                                  <div className="text-xs text-zinc-400">
                                    Entrega: {deliveryDisplayName(s.deliveryAudioUrl)}
                                  </div>
                                )}
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {s.status === "pendente" && (
                                    <button
                                      type="button"
                                      onClick={() => aceitarServico(s.id)}
                                      disabled={updatingId === s.id}
                                      className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
                                    >
                                      Aceitar
                                    </button>
                                  )}
                                  {s.status === "aceito" && (
                                    <button
                                      type="button"
                                      onClick={() => iniciarServico(s.id)}
                                      disabled={updatingId === s.id}
                                      className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                                    >
                                      Iniciar
                                    </button>
                                  )}
                                  {s.status === "em_andamento" && (
                                    <button
                                      type="button"
                                      onClick={() => abrirModalConcluir(s)}
                                      disabled={updatingId === s.id}
                                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 disabled:opacity-50"
                                    >
                                      Entregar arquivo
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="px-4 py-2 bg-zinc-900/50 text-xs text-zinc-500 flex justify-between">
                  <span>
                    Pendentes: {items.filter((s) => s.status === "pendente").length} · Aceitos:{" "}
                    {items.filter((s) => s.status === "aceito").length} · Em andamento:{" "}
                    {items.filter((s) => s.status === "em_andamento").length}
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
