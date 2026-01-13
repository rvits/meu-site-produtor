"use client";

import { useEffect, useState } from "react";

export default function AdminResetSenhaPage() {
  const [email, setEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [usuario, setUsuario] = useState<any>(null);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function verificarUsuario() {
    if (!email) {
      setErro("Digite um email");
      return;
    }

    setCarregando(true);
    setErro("");
    setMensagem("");

    try {
      const res = await fetch(`/api/admin/reset-senha?email=${encodeURIComponent(email)}`);
      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao verificar usuário");
        setUsuario(null);
      } else {
        setUsuario(data.usuario);
        setMensagem("Usuário encontrado!");
      }
    } catch (err) {
      setErro("Erro ao verificar usuário");
      setUsuario(null);
    } finally {
      setCarregando(false);
    }
  }

  async function resetarSenha() {
    if (!email || !novaSenha) {
      setErro("Email e nova senha são obrigatórios");
      return;
    }

    if (novaSenha.length < 6) {
      setErro("Senha deve ter no mínimo 6 caracteres");
      return;
    }

    setCarregando(true);
    setErro("");
    setMensagem("");

    try {
      const res = await fetch("/api/admin/reset-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, novaSenha }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErro(data.error || "Erro ao resetar senha");
      } else {
        setMensagem(data.message);
        setNovaSenha("");
      }
    } catch (err) {
      setErro("Erro ao resetar senha");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Resetar Senha</h1>
        <p className="text-zinc-400">Verificar usuários e resetar senhas</p>
      </div>

      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 space-y-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium text-zinc-300">Email do Usuário</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && verificarUsuario()}
              className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100"
              placeholder="email@exemplo.com"
            />
            <button
              onClick={verificarUsuario}
              disabled={carregando}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Verificar
            </button>
          </div>
        </div>

        {usuario && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <h3 className="font-semibold text-green-400 mb-2">Usuário Encontrado:</h3>
            <div className="text-sm text-zinc-300 space-y-1">
              <div><strong>Nome:</strong> {usuario.nomeArtistico}</div>
              <div><strong>Email:</strong> {usuario.email}</div>
              <div><strong>Role:</strong> {usuario.role}</div>
              <div><strong>Bloqueado:</strong> {usuario.blocked ? "Sim" : "Não"}</div>
              <div><strong>Criado em:</strong> {new Date(usuario.createdAt).toLocaleString("pt-BR")}</div>
            </div>
          </div>
        )}

        {usuario && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">Nova Senha</label>
            <input
              type="password"
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100"
              placeholder="Digite a nova senha"
            />
            <button
              onClick={resetarSenha}
              disabled={carregando || !novaSenha}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
            >
              {carregando ? "Processando..." : "Resetar Senha"}
            </button>
          </div>
        )}

        {erro && (
          <div className="rounded-lg bg-red-500/20 border border-red-500/50 px-4 py-2 text-sm text-red-400">
            {erro}
          </div>
        )}

        {mensagem && (
          <div className="rounded-lg bg-green-500/20 border border-green-500/50 px-4 py-2 text-sm text-green-400">
            {mensagem}
          </div>
        )}
      </div>
    </div>
  );
}
