"use client";

import { useEffect, useState } from "react";

interface Agendamento {
  id: number;
  data: string;
  hora: string;
  cliente: string;
  email: string;
  tipo: string;
  valorEstimado: number;
  status: "PENDENTE" | "CONFIRMADO" | "CONCLUIDO" | "CANCELADO";
}

export default function AdminAgendamentosPage() {
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarAgendamentos();
  }, []);

  async function carregarAgendamentos() {
    try {
      const r = await fetch("/api/admin/agendamentos");
      const d = await r.json();
      setAgendamentos(d.agendamentos || []);
    } catch (err) {
      console.error("Erro ao carregar agendamentos", err);
    } finally {
      setLoading(false);
    }
  }

  async function atualizarStatus(
    id: number,
    status: Agendamento["status"]
  ) {
    await fetch(`/api/admin/agendamentos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    carregarAgendamentos();
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando agendamentos...</p>;
  }

  return (
    <>
      <h1 className="mb-6 text-3xl font-bold text-red-400">
        Agendamentos
      </h1>

      {agendamentos.length === 0 ? (
        <p className="text-zinc-400">
          Nenhum agendamento encontrado.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Serviço</th>
                <th className="px-4 py-3 text-left">Valor</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {agendamentos.map((a) => (
                <tr
                  key={a.id}
                  className="border-t border-zinc-800"
                >
                  <td className="px-4 py-3">
                    {a.data} • {a.hora}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.cliente}</div>
                    <div className="text-xs text-zinc-400">
                      {a.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">{a.tipo}</td>
                  <td className="px-4 py-3 text-red-300">
                    R$ {a.valorEstimado},00
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        a.status === "PENDENTE"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : a.status === "CONFIRMADO"
                          ? "bg-blue-500/20 text-blue-300"
                          : a.status === "CONCLUIDO"
                          ? "bg-green-500/20 text-green-300"
                          : "bg-red-500/20 text-red-300"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <button
                      onClick={() =>
                        atualizarStatus(a.id, "CONFIRMADO")
                      }
                      className="text-xs text-blue-400 hover:underline"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() =>
                        atualizarStatus(a.id, "CONCLUIDO")
                      }
                      className="text-xs text-green-400 hover:underline"
                    >
                      Concluir
                    </button>
                    <button
                      onClick={() =>
                        atualizarStatus(a.id, "CANCELADO")
                      }
                      className="text-xs text-red-400 hover:underline"
                    >
                      Cancelar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
