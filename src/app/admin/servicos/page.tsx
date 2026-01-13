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

export default function AdminServicosPage() {
  const [servicos, setServicos] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarServicos();
  }, []);

  async function carregarServicos() {
    try {
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
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando serviços...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Serviços</h1>
        <p className="text-zinc-400">Gerenciar serviços selecionados e aceitos</p>
      </div>

      {servicos.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhum serviço encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-800/50">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {servicos.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 text-zinc-300 text-xs">
                    {new Date(s.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-100">{s.user.nomeArtistico}</div>
                    <div className="text-xs text-zinc-400">{s.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{s.tipo}</td>
                  <td className="px-4 py-3 text-zinc-300 text-xs max-w-xs truncate">
                    {s.description || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      s.status === "aceito" ? "bg-green-500/20 text-green-300" :
                      s.status === "pendente" ? "bg-yellow-500/20 text-yellow-300" :
                      s.status === "em_andamento" ? "bg-blue-500/20 text-blue-300" :
                      s.status === "concluido" ? "bg-purple-500/20 text-purple-300" :
                      "bg-red-500/20 text-red-300"
                    }`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <select
                      value={s.status}
                      onChange={(e) => atualizarServico(s.id, e.target.value)}
                      className="rounded bg-zinc-900 border border-zinc-600 px-2 py-1 text-xs"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="aceito">Aceito</option>
                      <option value="em_andamento">Em Andamento</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
