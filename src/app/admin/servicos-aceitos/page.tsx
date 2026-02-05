"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  tipo: string;
  description?: string;
  status: string;
  acceptedAt?: string;
  user: {
    nomeArtistico: string;
    email: string;
  };
  createdAt: string;
}

export default function AdminServicosAceitosPage() {
  const [servicos, setServicos] = useState<Service[]>([]);
  const [servicosFiltrados, setServicosFiltrados] = useState<Service[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarServicos();
  }, []);

  useEffect(() => {
    if (busca.trim() === "") {
      setServicosFiltrados(servicos);
    } else {
      const termo = busca.toLowerCase();
      const filtrados = servicos.filter(
        (s) =>
          s.user.nomeArtistico.toLowerCase().includes(termo) ||
          s.user.email.toLowerCase().includes(termo)
      );
      setServicosFiltrados(filtrados);
    }
  }, [busca, servicos]);

  async function carregarServicos() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/servicos");
      if (res.ok) {
        const data = await res.json();
        // Filtrar apenas aceitos
        const aceitos = (data.servicos || []).filter(
          (s: Service) => s.status === "aceito" || s.status === "em_andamento" || s.status === "concluido"
        );
        setServicos(aceitos);
        setServicosFiltrados(aceitos);
      }
    } catch (err) {
      console.error("Erro ao carregar serviços", err);
    } finally {
      setLoading(false);
    }
  }

  async function atualizarStatus(id: string, status: string) {
    try {
      const res = await fetch(`/api/admin/servicos?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (res.ok) {
        await carregarServicos();
      }
    } catch (err) {
      console.error("Erro ao atualizar serviço", err);
      alert("Erro ao atualizar serviço. Tente novamente.");
    }
  }

  function getStatusInfo(status: string) {
    if (status === "concluido") {
      return {
        label: "Concluído",
        color: "bg-green-500",
        textColor: "text-green-300",
        bgColor: "bg-green-500/20",
      };
    }
    if (status === "em_andamento") {
      return {
        label: "Em Andamento",
        color: "bg-blue-500",
        textColor: "text-blue-300",
        bgColor: "bg-blue-500/20",
      };
    }
    return {
      label: "Aceito",
      color: "bg-yellow-500",
      textColor: "text-yellow-300",
      bgColor: "bg-yellow-500/20",
    };
  }

  function isConcluido(status: string) {
    return status === "concluido";
  }

  function isEmAndamento(status: string) {
    return status === "em_andamento" || status === "aceito";
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando serviços aceitos...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Serviços Aceitos</h1>
        <p className="text-zinc-400">
          Gerencie serviços aceitos. Marque como concluído quando o serviço for finalizado.
        </p>
      </div>

      {/* Input de Busca */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou email do usuário..."
          className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
        />
        {busca && (
          <p className="mt-2 text-sm text-zinc-400">
            {servicosFiltrados.length} serviço(s) encontrado(s)
          </p>
        )}
      </div>

      {servicosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhum serviço aceito encontrado.
        </div>
      ) : (
        <div className="space-y-4">
          {servicosFiltrados.map((s) => {
            const statusInfo = getStatusInfo(s.status);
            return (
              <div
                key={s.id}
                className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-3 h-3 rounded-full ${statusInfo.color}`} />
                      <span className={`text-sm font-semibold ${statusInfo.textColor}`}>
                        {statusInfo.label}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <span className="text-xs text-zinc-400">Cliente:</span>
                        <div className="font-medium text-zinc-100">{s.user.nomeArtistico}</div>
                        <div className="text-xs text-zinc-400">{s.user.email}</div>
                      </div>

                      <div>
                        <span className="text-xs text-zinc-400">Tipo:</span>
                        <div className="text-zinc-300">{s.tipo}</div>
                      </div>

                      {s.description && (
                        <div>
                          <span className="text-xs text-zinc-400">Descrição:</span>
                          <div className="text-zinc-300 text-sm">{s.description}</div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-zinc-400">Solicitado em:</span>
                          <div className="text-zinc-300">
                            {new Date(s.createdAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </div>
                        </div>
                        {s.acceptedAt && (
                          <div>
                            <span className="text-zinc-400">Aceito em:</span>
                            <div className="text-zinc-300">
                              {new Date(s.acceptedAt).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 ml-4">
                    {isEmAndamento(s.status) && (
                      <button
                        onClick={() => atualizarStatus(s.id, "concluido")}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition"
                      >
                        Marcar como Concluído
                      </button>
                    )}
                    {isConcluido(s.status) && (
                      <button
                        onClick={() => atualizarStatus(s.id, "em_andamento")}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition"
                      >
                        Reabrir
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
