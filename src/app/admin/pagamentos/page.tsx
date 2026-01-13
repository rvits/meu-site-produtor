"use client";

import { useEffect, useState } from "react";

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  type: string;
  mercadopagoId?: string;
  user: {
    nomeArtistico: string;
    email: string;
  };
  createdAt: string;
}

export default function AdminPagamentosPage() {
  const [pagamentos, setPagamentos] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarPagamentos();
  }, []);

  async function carregarPagamentos() {
    try {
      const res = await fetch("/api/admin/pagamentos");
      if (res.ok) {
        const data = await res.json();
        setPagamentos(data.pagamentos || []);
      }
    } catch (err) {
      console.error("Erro ao carregar pagamentos", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando pagamentos...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Pagamentos</h1>
        <p className="text-zinc-400">Visualizar todas as transações</p>
      </div>

      {pagamentos.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhum pagamento encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-800/50">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Cliente</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">MP ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {pagamentos.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-zinc-300 text-xs">
                    {new Date(p.createdAt).toLocaleString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-zinc-100">{p.user.nomeArtistico}</div>
                    <div className="text-xs text-zinc-400">{p.user.email}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">{p.type}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-400">
                    {p.currency} {p.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      p.status === "approved" ? "bg-green-500/20 text-green-300" :
                      p.status === "pending" ? "bg-yellow-500/20 text-yellow-300" :
                      p.status === "rejected" ? "bg-red-500/20 text-red-300" :
                      "bg-gray-500/20 text-gray-300"
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 font-mono">
                    {p.mercadopagoId || "-"}
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
