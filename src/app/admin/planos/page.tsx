"use client";

import { useEffect, useState } from "react";

interface UserPlan {
  id: string;
  planId: string;
  planName: string;
  modo: string;
  amount: number;
  status: string;
  startDate: string;
  endDate?: string;
  user: {
    nomeArtistico: string;
    email: string;
  };
  createdAt: string;
}

export default function AdminPlanosPage() {
  const [planos, setPlanos] = useState<UserPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarPlanos();
  }, []);

  async function carregarPlanos() {
    try {
      const res = await fetch("/api/admin/planos");
      if (res.ok) {
        const data = await res.json();
        setPlanos(data.planos || []);
      }
    } catch (err) {
      console.error("Erro ao carregar planos", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando planos...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Planos Assinados</h1>
        <p className="text-zinc-400">Ver todas as assinaturas ativas e inativas</p>
      </div>

      {planos.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhum plano encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-800/50">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Plano</th>
                <th className="px-4 py-3 text-left">Modo</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Período</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {planos.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-100">{p.user.nomeArtistico}</div>
                    <div className="text-xs text-zinc-400">{p.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{p.planName}</td>
                  <td className="px-4 py-3 text-zinc-300 capitalize">{p.modo}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400">
                    R$ {p.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      p.status === "active" ? "bg-green-500/20 text-green-300" :
                      p.status === "cancelled" ? "bg-red-500/20 text-red-300" :
                      "bg-gray-500/20 text-gray-300"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-300">
                    <div>Início: {new Date(p.startDate).toLocaleDateString("pt-BR")}</div>
                    {p.endDate && (
                      <div>Fim: {new Date(p.endDate).toLocaleDateString("pt-BR")}</div>
                    )}
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
