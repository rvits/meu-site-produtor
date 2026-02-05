"use client";

import { useEffect, useState } from "react";

interface Service {
  id: string;
  tipo: string;
  description?: string;
  status: string;
  user: {
    nomeArtistico: string;
    email: string;
  };
  createdAt: string;
}

export default function AdminServicosSolicitadosPage() {
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
        // Filtrar apenas pendentes e recusados
        const solicitados = (data.servicos || []).filter(
          (s: Service) => s.status === "pendente" || s.status === "cancelado" || s.status === "recusado"
        );
        setServicos(solicitados);
        setServicosFiltrados(solicitados);
      }
    } catch (err) {
      console.error("Erro ao carregar serviços", err);
    } finally {
      setLoading(false);
    }
  }

  async function atualizarServico(id: string, status: string) {
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

  function getStatusColor(status: string) {
    if (status === "pendente") return "bg-orange-500";
    if (status === "cancelado" || status === "recusado") return "bg-red-500";
    return "bg-zinc-500";
  }

  function getStatusLabel(status: string) {
    if (status === "pendente") return "Pendente";
    if (status === "cancelado") return "Cancelado";
    if (status === "recusado") return "Recusado";
    return status;
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando serviços solicitados...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Serviços Solicitados</h1>
        <p className="text-zinc-400">Gerencie serviços pendentes e recusados. Apenas serviços pendentes e recusados aparecem aqui.</p>
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
          Nenhum serviço solicitado encontrado.
        </div>
      ) : (
        <div className="space-y-4">
          {servicosFiltrados.map((s) => (
            <div
              key={s.id}
              className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-3 h-3 rounded-full ${getStatusColor(s.status)}`}
                    />
                    <span className="text-sm font-semibold text-zinc-300">
                      {getStatusLabel(s.status)}
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
                    
                    <div>
                      <span className="text-xs text-zinc-400">Data:</span>
                      <div className="text-zinc-300 text-sm">
                        {new Date(s.createdAt).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2 ml-4">
                  {s.status === "pendente" && (
                    <>
                      <button
                        onClick={() => atualizarServico(s.id, "aceito")}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition"
                      >
                        Aceitar
                      </button>
                      <button
                        onClick={() => atualizarServico(s.id, "recusado")}
                        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition"
                      >
                        Recusar
                      </button>
                    </>
                  )}
                  {s.status === "recusado" && (
                    <button
                      onClick={() => atualizarServico(s.id, "pendente")}
                      className="rounded-lg bg-yellow-600 px-4 py-2 text-sm font-semibold text-white hover:bg-yellow-500 transition"
                    >
                      Reabrir
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
