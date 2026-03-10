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

  useEffect(() => {
    carregarServicos();
  }, []);

  async function carregarServicos() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/servicos");
      if (res.ok) {
        const data = await res.json();
        // Apenas serviços vinculados a agendamento (selecionados no agendamento)
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

  async function marcarComoFeito(id: string) {
    try {
      setUpdatingId(id);
      const res = await fetch(`/api/admin/servicos?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "concluido" }),
      });
      if (res.ok) await carregarServicos();
      else alert("Erro ao atualizar. Tente novamente.");
    } catch (err) {
      console.error("Erro ao atualizar serviço", err);
      alert("Erro ao atualizar serviço. Tente novamente.");
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
      alert("Erro ao atualizar serviço. Tente novamente.");
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

  // Agrupar por agendamento (appointmentId + appointment.data para ordenar)
  const grupos = filtrados.reduce<Record<GroupKey, Service[]>>((acc, s) => {
    const key: GroupKey = s.appointmentId != null
      ? `ag-${s.appointmentId}`
      : "sem-agendamento";
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {});

  const gruposOrdenados = Object.entries(grupos).sort(([, a], [, b]) => {
    const dataA = a[0]?.appointment?.data;
    const dataB = b[0]?.appointment?.data;
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
            Serviços por agendamento: quais já foram feitos e quais ainda estão a
            fazer. Use &quot;Registrar como feito&quot; quando concluir o serviço.
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
            const apt = items[0]?.appointment;
            const agendamentoId = items[0]?.appointmentId;
            const user = items[0]?.user;
            const pendentes = items.filter(
              (s) => s.status !== "concluido" && s.status !== "cancelado" && s.status !== "recusado"
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
                        className="flex items-center justify-between gap-4 py-2 border-b border-zinc-700/50 last:border-0"
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
                              ? "Feito"
                              : isCanceladoOuRecusado
                                ? s.status === "cancelado"
                                  ? "Cancelado (agendamento cancelado)"
                                  : "Recusado"
                                : "A fazer"}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {!isFeito && !isCanceladoOuRecusado && (
                            <button
                              onClick={() => marcarComoFeito(s.id)}
                              disabled={updatingId === s.id}
                              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition disabled:opacity-50"
                            >
                              {updatingId === s.id
                                ? "Salvando..."
                                : "Registrar como feito"}
                            </button>
                          )}
                          {isFeito && (
                            <button
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
