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
  acceptedAt?: string;
  appointmentId: number | null;
  appointment: Appointment | null;
  user: {
    nomeArtistico: string;
    email: string;
  };
  createdAt: string;
}

export default function AdminServicosGeraisPage() {
  const [servicos, setServicos] = useState<Service[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarServicos();
  }, []);

  async function carregarServicos() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/servicos");
      if (res.ok) {
        const data = await res.json();
        setServicos(data.servicos || []);
      }
    } catch (err) {
      console.error("Erro ao carregar serviços", err);
    } finally {
      setLoading(false);
    }
  }

  const filtradosPorBusca = busca.trim()
    ? servicos.filter(
        (s) =>
          s.user.nomeArtistico.toLowerCase().includes(busca.toLowerCase()) ||
          s.user.email.toLowerCase().includes(busca.toLowerCase()) ||
          (s.appointment?.id && String(s.appointment.id).includes(busca))
      )
    : servicos;

  const filtrados =
    filtroStatus === "todos"
      ? filtradosPorBusca
      : filtradosPorBusca.filter((s) => s.status === filtroStatus);

  function getStatusInfo(status: string) {
    switch (status) {
      case "pendente":
        return {
          label: "Solicitado",
          color: "bg-amber-500",
          textColor: "text-amber-300",
          bgColor: "bg-amber-500/20",
        };
      case "aceito":
        return {
          label: "Aceito",
          color: "bg-green-500",
          textColor: "text-green-300",
          bgColor: "bg-green-500/20",
        };
      case "em_andamento":
        return {
          label: "Em andamento",
          color: "bg-blue-500",
          textColor: "text-blue-300",
          bgColor: "bg-blue-500/20",
        };
      case "recusado":
        return {
          label: "Recusado",
          color: "bg-red-500",
          textColor: "text-red-300",
          bgColor: "bg-red-500/20",
        };
      case "cancelado":
        return {
          label: "Cancelado",
          color: "bg-zinc-500",
          textColor: "text-zinc-300",
          bgColor: "bg-zinc-500/20",
        };
      case "concluido":
        return {
          label: "Concluído",
          color: "bg-blue-500",
          textColor: "text-blue-300",
          bgColor: "bg-blue-500/20",
        };
      default:
        return {
          label: status,
          color: "bg-zinc-500",
          textColor: "text-zinc-300",
          bgColor: "bg-zinc-500/20",
        };
    }
  }

  const [excluindoId, setExcluindoId] = useState<string | null>(null);

  async function excluirServico(id: string) {
    if (!confirm("Excluir este serviço cancelado do banco de dados? Esta ação não pode ser desfeita.")) {
      return;
    }
    try {
      setExcluindoId(id);
      const res = await fetch(`/api/admin/servicos?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        await carregarServicos();
      } else {
        alert(data.error || "Erro ao excluir serviço.");
      }
    } catch (err) {
      console.error("Erro ao excluir serviço", err);
      alert("Erro ao excluir serviço.");
    } finally {
      setExcluindoId(null);
    }
  }

  if (loading) {
    return (
      <p className="text-zinc-400">Carregando serviços gerais...</p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">
          Serviços Gerais
        </h1>
        <p className="text-zinc-400">
          Visão geral: solicitados, aceitos, em andamento, recusados, cancelados e concluídos.
          O status de serviço acompanha o fluxo do agendamento no admin.
        </p>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 flex flex-wrap gap-4 items-center">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, email ou ID do agendamento..."
          className="flex-1 min-w-[200px] rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
        />
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          className="rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 focus:border-red-500 focus:outline-none"
        >
          <option value="todos">Todos os status</option>
          <option value="pendente">Solicitado</option>
          <option value="aceito">Aceito</option>
          <option value="em_andamento">Em andamento</option>
          <option value="recusado">Recusado</option>
          <option value="cancelado">Cancelado</option>
          <option value="concluido">Concluído</option>
        </select>
        {busca && (
          <p className="text-sm text-zinc-400">
            {filtrados.length} serviço(s)
          </p>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhum serviço encontrado.
        </div>
      ) : (
        <div className="space-y-4">
          {filtrados.map((s) => {
            const statusInfo = getStatusInfo(s.status);
            return (
              <div
                key={s.id}
                className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-3 flex-wrap">
                      <div
                        className={`w-3 h-3 rounded-full ${statusInfo.color}`}
                      />
                      <span
                        className={`text-sm font-semibold ${statusInfo.textColor}`}
                      >
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-zinc-400">Cliente:</span>
                        <div className="font-medium text-zinc-100">
                          {s.user.nomeArtistico}
                        </div>
                        <div className="text-xs text-zinc-400">
                          {s.user.email}
                        </div>
                      </div>

                      <div>
                        <span className="text-xs text-zinc-400">Tipo:</span>
                        <div className="text-zinc-300">{s.tipo}</div>
                      </div>

                      {s.description && (
                        <div>
                          <span className="text-xs text-zinc-400">
                            Descrição:
                          </span>
                          <div className="text-zinc-300 text-sm">
                            {s.description}
                          </div>
                        </div>
                      )}

                      {s.appointmentId != null && s.appointment && (
                        <div className="mt-2 p-2 rounded-lg bg-zinc-900/60 border border-zinc-700">
                          <span className="text-xs text-zinc-500">
                            Agendamento:
                          </span>
                          <div className="flex items-center gap-2 flex-wrap mt-1">
                            <Link
                              href={`/admin/agendamentos?highlight=${s.appointment.id}`}
                              className="font-mono text-red-400 hover:underline"
                            >
                              #{s.appointment.id}
                            </Link>
                            <span className="text-zinc-400 text-sm">
                              {new Date(s.appointment.data).toLocaleDateString(
                                "pt-BR",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </span>
                            <span className="text-xs text-zinc-500">
                              {s.appointment.tipo} · status:{" "}
                              {s.appointment.status}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-500 mt-1">
                            O status do serviço (aceito/recusado/cancelado) é
                            atualizado quando o agendamento é alterado.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-xs mt-2">
                        <div>
                          <span className="text-zinc-400">
                            Solicitado em:
                          </span>
                          <div className="text-zinc-300">
                            {new Date(s.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </div>
                        {s.acceptedAt && (
                          <div>
                            <span className="text-zinc-400">Aceito em:</span>
                            <div className="text-zinc-300">
                              {new Date(
                                s.acceptedAt
                              ).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {s.status === "cancelado" && (
                    <button
                      type="button"
                      onClick={() => excluirServico(s.id)}
                      disabled={excluindoId === s.id}
                      className="mt-2 text-xs bg-red-600/80 hover:bg-red-600 text-white px-3 py-1 rounded transition-colors disabled:opacity-50"
                    >
                      {excluindoId === s.id ? "Excluindo..." : "Excluir"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
