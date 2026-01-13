"use client";

import { useEffect, useState } from "react";

interface Agendamento {
  id: number;
  data: string;
  duracaoMinutos: number;
  tipo: string;
  observacoes?: string;
  status: string;
  blocked: boolean;
  blockedAt?: string;
  blockedReason?: string;
  user: {
    nomeArtistico: string;
    email: string;
  };
  createdAt: string;
}

export default function AdminAgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarAgendamentos();
  }, []);

  async function carregarAgendamentos() {
    try {
      const res = await fetch("/api/admin/agendamentos");
      if (res.ok) {
        const data = await res.json();
        setAgendamentos(data.agendamentos || []);
      }
    } catch (err) {
      console.error("Erro ao carregar agendamentos", err);
    } finally {
      setLoading(false);
    }
  }

  async function atualizarAgendamento(id: number, updates: { status?: string; blocked?: boolean; blockedReason?: string }) {
    try {
      const res = await fetch(`/api/admin/agendamentos?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        await carregarAgendamentos();
      }
    } catch (err) {
      console.error("Erro ao atualizar agendamento", err);
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando agendamentos...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Agendamentos</h1>
        <p className="text-zinc-400">Gerencie sessões e horários</p>
      </div>

      {agendamentos.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhum agendamento encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-800/50">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left">Data/Hora</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Serviço</th>
                <th className="px-4 py-3 text-left">Duração</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Bloqueado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {agendamentos.map((a) => (
                <tr key={a.id} className={a.blocked ? "bg-red-950/20" : ""}>
                  <td className="px-4 py-3 text-zinc-300">
                    {new Date(a.data).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-100">{a.user.nomeArtistico}</div>
                    <div className="text-xs text-zinc-400">{a.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{a.tipo}</td>
                  <td className="px-4 py-3 text-zinc-300">{a.duracaoMinutos} min</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        a.status === "pendente"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : a.status === "confirmado"
                          ? "bg-blue-500/20 text-blue-300"
                          : a.status === "concluido"
                          ? "bg-green-500/20 text-green-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.blocked ? (
                      <span className="text-xs text-red-400">Sim</span>
                    ) : (
                      <span className="text-xs text-green-400">Não</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <select
                      value={a.status}
                      onChange={(e) => atualizarAgendamento(a.id, { status: e.target.value })}
                      className="rounded bg-zinc-900 border border-zinc-600 px-2 py-1 text-xs"
                    >
                      <option value="pendente">Pendente</option>
                      <option value="confirmado">Confirmado</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                    <button
                      onClick={() => atualizarAgendamento(a.id, { blocked: !a.blocked, blockedReason: !a.blocked ? "Bloqueado pelo admin" : undefined })}
                      className={`rounded px-3 py-1 text-xs font-semibold ${
                        a.blocked
                          ? "bg-green-600 text-white hover:bg-green-500"
                          : "bg-red-600 text-white hover:bg-red-500"
                      }`}
                    >
                      {a.blocked ? "Liberar" : "Bloquear"}
                    </button>
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
