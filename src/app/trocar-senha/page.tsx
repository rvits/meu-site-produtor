"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function TrocarSenhaContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const token = searchParams.get("token") || "";

  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");

    if (!email || !token) {
      setErro("Dados inválidos. Por favor, solicite a recuperação novamente.");
      return;
    }

    if (senha.length < 6) {
      setErro("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      setErro("As senhas não conferem.");
      return;
    }

    setCarregando(true);

    try {
      const res = await fetch("/api/trocar-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token, novaSenha: senha }),
      });

      const data = await res.json();
      setCarregando(false);

      if (!res.ok) {
        setErro(data.error || "Erro ao trocar senha. Tente novamente.");
        return;
      }

      setSucesso(true);
      setTimeout(() => {
        router.push("/login");
      }, 3000);
    } catch (err) {
      setCarregando(false);
      setErro("Erro ao trocar senha. Tente novamente.");
    }
  }

  if (sucesso) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 py-12 text-zinc-100">
        <div className="w-full max-w-md text-center">
          <div className="rounded-2xl border border-green-700/40 bg-zinc-900 p-6">
            <div className="mb-4 text-4xl">✅</div>
            <h1 className="mb-2 text-2xl font-semibold text-green-400">
              Senha Alterada com Sucesso!
            </h1>
            <p className="mb-4 text-sm text-zinc-400">
              Sua senha foi atualizada com sucesso. Você será redirecionado para a página de login em instantes.
            </p>
            <Link
              href="/login"
              className="inline-block rounded-full bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-500 transition"
            >
              Ir para Login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 text-zinc-100">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl text-center font-semibold">
          Criar Nova Senha
        </h1>

        <p className="mb-6 text-sm text-center text-zinc-400">
          Digite sua nova senha abaixo. Certifique-se de escolher uma senha segura.
        </p>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-red-700/40 bg-zinc-900 p-6"
        >
          <div className="space-y-1">
            <label className="text-xs text-zinc-300">Nova Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? "text" : "password"}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 pr-10 text-sm outline-none focus:border-red-500"
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
                aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarSenha ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-300">Confirmar Nova Senha</label>
            <div className="relative">
              <input
                type={mostrarConfirmarSenha ? "text" : "password"}
                required
                value={confirmarSenha}
                onChange={(e) => setConfirmarSenha(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 pr-10 text-sm outline-none focus:border-red-500"
                placeholder="Digite a senha novamente"
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
                aria-label={mostrarConfirmarSenha ? "Ocultar senha" : "Mostrar senha"}
              >
                {mostrarConfirmarSenha ? (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {erro && (
            <p className="rounded bg-red-950/40 px-3 py-2 text-xs text-red-400">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando}
            className={`w-full rounded-full px-4 py-2 text-sm font-semibold transition ${
              carregando
                ? "cursor-wait bg-zinc-900 text-zinc-500"
                : "bg-red-600 text-white hover:bg-red-500"
            }`}
          >
            {carregando ? "Alterando senha..." : "Alterar Senha"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-xs text-zinc-400 hover:text-red-400 underline"
          >
            Voltar para login
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function TrocarSenhaPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center px-6 py-12 text-zinc-100">
        <div className="w-full max-w-md">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-zinc-800 rounded"></div>
            <div className="h-4 bg-zinc-800 rounded"></div>
            <div className="h-10 bg-zinc-800 rounded"></div>
          </div>
        </div>
      </main>
    }>
      <TrocarSenhaContent />
    </Suspense>
  );
}
