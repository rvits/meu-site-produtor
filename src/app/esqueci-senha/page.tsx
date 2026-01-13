"use client";

import { useState } from "react";
import Link from "next/link";

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [modoAdmin, setModoAdmin] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setMensagem("");
    setCarregando(true);

    try {
      const res = await fetch("/api/esqueci-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, novaSenha: modoAdmin ? novaSenha : undefined }),
      });

      const data = await res.json();
      setCarregando(false);

      if (!res.ok) {
        setErro(data.error || "Erro ao processar solicitação");
        return;
      }

      setMensagem(
        modoAdmin
          ? "Senha alterada com sucesso!"
          : "Se o email existir, você receberá instruções para redefinir sua senha."
      );
      setEmail("");
      setNovaSenha("");
    } catch (err) {
      setCarregando(false);
      setErro("Erro ao processar solicitação");
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12 text-zinc-100">
      <h1 className="mb-2 text-2xl text-center font-semibold">
        Esqueci minha senha
      </h1>

      <p className="mb-6 text-sm text-center text-zinc-400">
        Digite seu email para receber instruções de recuperação.
      </p>

      <div className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          id="modoAdmin"
          checked={modoAdmin}
          onChange={(e) => setModoAdmin(e.target.checked)}
          className="rounded border-zinc-600"
        />
        <label htmlFor="modoAdmin" className="text-xs text-zinc-400">
          Modo Admin (resetar senha diretamente)
        </label>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-red-700/40 bg-zinc-900 p-6"
      >
        <div className="space-y-1">
          <label className="text-xs text-zinc-300">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500"
            placeholder="voce@exemplo.com"
          />
        </div>

        {modoAdmin && (
          <div className="space-y-1">
            <label className="text-xs text-zinc-300">Nova Senha</label>
            <input
              type="password"
              required={modoAdmin}
              value={novaSenha}
              onChange={(e) => setNovaSenha(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500"
              placeholder="Nova senha"
            />
          </div>
        )}

        {erro && (
          <p className="rounded bg-red-950/40 px-3 py-2 text-xs text-red-400">
            {erro}
          </p>
        )}

        {mensagem && (
          <p className="rounded bg-green-950/40 px-3 py-2 text-xs text-green-400">
            {mensagem}
          </p>
        )}

        <button
          type="submit"
          disabled={carregando}
          className={`mt-2 w-full rounded-full px-4 py-2 text-sm font-semibold transition ${
            carregando
              ? "cursor-wait bg-zinc-900 text-zinc-500"
              : "bg-red-600 text-white hover:bg-red-500"
          }`}
        >
          {carregando ? "Processando..." : modoAdmin ? "Resetar Senha" : "Enviar"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-xs text-zinc-400 hover:text-red-400 underline"
        >
          Voltar para login
        </Link>
      </div>
    </main>
  );
}
