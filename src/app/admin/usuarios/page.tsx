"use client";

import { useEffect, useState } from "react";

interface Usuario {
  id: string;
  nomeArtistico: string;
  email: string;
  role: string;
  blocked: boolean;
  blockedAt?: string;
  blockedReason?: string;
  createdAt: string;
  _count: {
    appointments: number;
    payments: number;
    userPlans: number;
  };
  lastLogin?: {
    ipAddress: string;
    userAgent: string;
    createdAt: string;
  };
  loginCount: number;
  failedLoginCount: number;
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarUsuarios();
  }, []);

  async function carregarUsuarios() {
    try {
      const res = await fetch("/api/admin/usuarios");
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.usuarios || []);
      }
    } catch (err) {
      console.error("Erro ao carregar usuários", err);
    } finally {
      setLoading(false);
    }
  }

  async function atualizarUsuario(id: string, updates: { role?: string; blocked?: boolean; blockedReason?: string }) {
    try {
      const res = await fetch(`/api/admin/usuarios?id=${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (res.ok) {
        await carregarUsuarios();
      }
    } catch (err) {
      console.error("Erro ao atualizar usuário", err);
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando usuários...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Usuários</h1>
        <p className="text-zinc-400">Gerenciar clientes, permissões e histórico de logins</p>
      </div>

      {usuarios.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhum usuário encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-700 bg-zinc-800/50">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900 text-zinc-300">
              <tr>
                <th className="px-4 py-3 text-left">Nome</th>
                <th className="px-4 py-3 text-left">Email</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Último Login</th>
                <th className="px-4 py-3 text-left">Logins</th>
                <th className="px-4 py-3 text-left">Estatísticas</th>
                <th className="px-4 py-3 text-left">Bloqueado</th>
                <th className="px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-700">
              {usuarios.map((u) => (
                <tr key={u.id} className={u.blocked ? "bg-red-950/20" : ""}>
                  <td className="px-4 py-3 font-medium text-zinc-100">{u.nomeArtistico}</td>
                  <td className="px-4 py-3 text-zinc-300">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      u.role === "ADMIN" ? "bg-red-500/20 text-red-300" : "bg-blue-500/20 text-blue-300"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">
                    {u.lastLogin ? (
                      <>
                        <div>{new Date(u.lastLogin.createdAt).toLocaleString("pt-BR")}</div>
                        <div className="text-zinc-500">{u.lastLogin.ipAddress}</div>
                      </>
                    ) : (
                      <span className="text-zinc-500">Nunca</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">
                    <div>✓ {u.loginCount}</div>
                    <div className="text-red-400">✗ {u.failedLoginCount}</div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300 text-xs">
                    <div>📅 {u._count.appointments}</div>
                    <div>💰 {u._count.payments}</div>
                    <div>⭐ {u._count.userPlans}</div>
                  </td>
                  <td className="px-4 py-3">
                    {u.blocked ? (
                      <span className="text-xs text-red-400">
                        Sim {u.blockedReason && `(${u.blockedReason})`}
                      </span>
                    ) : (
                      <span className="text-xs text-green-400">Não</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <select
                      value={u.role}
                      onChange={(e) => atualizarUsuario(u.id, { role: e.target.value })}
                      className="rounded bg-zinc-900 border border-zinc-600 px-2 py-1 text-xs"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                    <button
                      onClick={() => atualizarUsuario(u.id, { blocked: !u.blocked, blockedReason: !u.blocked ? "Bloqueado pelo admin" : undefined })}
                      className={`rounded px-3 py-1 text-xs font-semibold ${
                        u.blocked
                          ? "bg-green-600 text-white hover:bg-green-500"
                          : "bg-red-600 text-white hover:bg-red-500"
                      }`}
                    >
                      {u.blocked ? "Liberar" : "Bloquear"}
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
