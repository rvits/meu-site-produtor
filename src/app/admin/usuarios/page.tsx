"use client";

import { useEffect, useState } from "react";

interface PlanoUsuario {
  id: string;
  planId: string;
  planName: string;
  modo: string;
  amount: number;
  status: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  subscription?: {
    id: string;
    status: string;
    paymentMethod: string;
    billingDay: number;
    nextBillingDate: string;
    lastBillingDate: string | null;
  } | null;
}

interface CupomUsuario {
  id: string;
  code: string;
  couponType: string; // "plano" ou "reembolso"
  discountType: string;
  discountValue: number;
  serviceType: string | null;
  used: boolean;
  usedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Usuario {
  id: string;
  nomeCompleto: string;
  nomeArtistico: string;
  email: string;
  telefone: string;
  cpf?: string | null;
  pais: string;
  estado: string;
  cidade: string;
  bairro: string;
  dataNascimento: string;
  estilosMusicais?: string | null;
  nacionalidade?: string | null;
  foto?: string | null;
  role: string;
  blocked: boolean;
  blockedAt?: string;
  blockedReason?: string;
  createdAt: string;
  _count: {
    appointments: number;
    payments: number;
    userPlans: number;
    services: number;
  };
  lastLogin?: {
    ipAddress: string;
    userAgent: string;
    createdAt: string;
  };
  loginCount: number;
  failedLoginCount: number;
  senhaTemporaria?: string;
  planos?: PlanoUsuario[];
  cupons?: CupomUsuario[];
}

function calcularIdade(dataNascimento: string): number {
  const hoje = new Date();
  const nascimento = new Date(dataNascimento);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const mes = hoje.getMonth() - nascimento.getMonth();
  if (mes < 0 || (mes === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return idade;
}

export default function AdminUsuariosPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuariosFiltrados, setUsuariosFiltrados] = useState<Usuario[]>([]);
  const [busca, setBusca] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarUsuarios();
  }, []);

  useEffect(() => {
    if (busca.trim() === "") {
      setUsuariosFiltrados(usuarios);
    } else {
      const termo = busca.toLowerCase();
      const filtrados = usuarios.filter(
        (u) =>
          u.nomeCompleto.toLowerCase().includes(termo) ||
          u.nomeArtistico.toLowerCase().includes(termo) ||
          u.email.toLowerCase().includes(termo) ||
          u.telefone.includes(termo)
      );
      setUsuariosFiltrados(filtrados);
    }
  }, [busca, usuarios]);

  async function carregarUsuarios() {
    try {
      const res = await fetch("/api/admin/usuarios");
      if (res.ok) {
        const data = await res.json();
        setUsuarios(data.usuarios || []);
        setUsuariosFiltrados(data.usuarios || []);
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

  async function resetarSenha(userId: string, email: string) {
    if (!confirm(`Tem certeza que deseja resetar a senha de ${email}? Uma nova senha temporária será gerada.`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action: "reset-password" }),
      });

      if (res.ok) {
        const data = await res.json();
        const senhaTemporaria = data.senhaTemporaria;
        
        // Atualizar o estado local para mostrar a senha
        setUsuarios(prev => prev.map(u => 
          u.id === userId ? { ...u, senhaTemporaria } : u
        ));
        setUsuariosFiltrados(prev => prev.map(u => 
          u.id === userId ? { ...u, senhaTemporaria } : u
        ));

        alert(`Senha resetada com sucesso!\n\nNova senha temporária: ${senhaTemporaria}\n\nCopie esta senha e envie para o usuário.`);
      } else {
        alert("Erro ao resetar senha.");
      }
    } catch (err) {
      console.error("Erro ao resetar senha", err);
      alert("Erro ao resetar senha.");
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

      {/* Input de Busca */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome completo, nome artístico, email ou telefone..."
          className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
        />
        {busca && (
          <p className="mt-2 text-sm text-zinc-400">
            {usuariosFiltrados.length} usuário(s) encontrado(s)
          </p>
        )}
      </div>

      {usuariosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhum usuário encontrado.
        </div>
      ) : (
        <div className="space-y-4">
          {usuariosFiltrados.map((u) => {
            const idade = calcularIdade(u.dataNascimento);
            const menorIdade = idade < 18;
            return (
              <div
                key={u.id}
                className={`rounded-xl border ${
                  u.blocked ? "border-red-700/50 bg-red-950/10" : "border-zinc-700 bg-zinc-800/50"
                } p-6`}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {/* Informações Básicas */}
                  <div className="space-y-2">
                    <h3 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
                      {u.nomeArtistico}
                      {menorIdade && (
                        <span className="text-xs bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">
                          Menor de idade
                        </span>
                      )}
                    </h3>
                    <div className="text-sm text-zinc-400 space-y-1">
                      <div><strong className="text-zinc-300">Nome Completo:</strong> {u.nomeCompleto}</div>
                      <div><strong className="text-zinc-300">Email:</strong> {u.email}</div>
                      <div><strong className="text-zinc-300">Telefone:</strong> {u.telefone}</div>
                      <div><strong className="text-zinc-300">CPF:</strong> {u.cpf ? u.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : <span className="text-yellow-400">Não cadastrado</span>}</div>
                      <div><strong className="text-zinc-300">Idade:</strong> {idade} anos</div>
                      <div><strong className="text-zinc-300">Data de Nascimento:</strong> {new Date(u.dataNascimento).toLocaleDateString("pt-BR")}</div>
                      {u.senhaTemporaria && (
                        <div className="mt-2 p-2 bg-yellow-900/30 border border-yellow-600/50 rounded">
                          <div className="text-xs text-yellow-300 font-semibold mb-1">Senha Temporária:</div>
                          <div className="text-yellow-200 font-mono text-sm">{u.senhaTemporaria}</div>
                          <div className="text-xs text-yellow-400 mt-1">⚠️ Esta senha foi gerada agora. Envie para o usuário.</div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Endereço */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-zinc-300">Endereço</h4>
                    <div className="text-sm text-zinc-400 space-y-1">
                      <div>{u.bairro}, {u.cidade}</div>
                      <div>{u.estado}, {u.pais}</div>
                      {u.nacionalidade && (
                        <div><strong className="text-zinc-300">Nacionalidade:</strong> {u.nacionalidade}</div>
                      )}
                      {u.estilosMusicais && (
                        <div><strong className="text-zinc-300">Estilos:</strong> {u.estilosMusicais}</div>
                      )}
                    </div>
                  </div>

                  {/* Estatísticas e Ações */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        u.role === "ADMIN" ? "bg-red-500/20 text-red-300" : "bg-blue-500/20 text-blue-300"
                      }`}>
                        {u.role}
                      </span>
                      {u.blocked ? (
                        <span className="text-xs text-red-400">Bloqueado</span>
                      ) : (
                        <span className="text-xs text-green-400">Ativo</span>
                      )}
                    </div>
                    <div className="text-sm text-zinc-400 space-y-1">
                      <div>📅 Agendamentos: {u._count.appointments}</div>
                      <div>💰 Pagamentos: {u._count.payments}</div>
                      <div>⭐ Planos: {u._count.userPlans}</div>
                      <div>🎵 Serviços: {u._count.services}</div>
                      <div>✓ Logins: {u.loginCount} | ✗ Falhas: {u.failedLoginCount}</div>
                    </div>
                    {u.lastLogin && (
                      <div className="text-xs text-zinc-500">
                        Último login: {new Date(u.lastLogin.createdAt).toLocaleString("pt-BR")}
                      </div>
                    )}
                    <div className="flex flex-col gap-2 mt-3">
                      <div className="flex gap-2">
                        <select
                          value={u.role}
                          onChange={(e) => atualizarUsuario(u.id, { role: e.target.value })}
                          className="rounded bg-zinc-900 border border-zinc-600 px-2 py-1 text-xs text-zinc-300"
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
                      </div>
                      <button
                        onClick={() => resetarSenha(u.id, u.email)}
                        className="rounded px-3 py-1 text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 w-full"
                      >
                        🔑 Resetar Senha
                      </button>
                    </div>
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
