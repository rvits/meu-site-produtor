"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    const ok = await login(email, senha);

    setCarregando(false);

    if (!ok) {
      setErro("Email ou senha inválidos.");
      return;
    }

    // Redirecionar para a página que o usuário estava tentando acessar, ou para /conta
    const redirectTo = searchParams.get("redirect") || "/conta";
    router.push(redirectTo);
  }

  return (
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

          <div className="space-y-1">
            <label className="text-xs text-zinc-300">Senha</label>
            <div className="relative">
              <input
                type={mostrarSenha ? "text" : "password"}
                required
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 pr-10 text-sm outline-none focus:border-red-500"
                placeholder="Sua senha"
                autoComplete="current-password"
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
            <div className="flex justify-end mt-2">
              <Link
                href="/esqueci-senha"
                className="text-xs text-zinc-400 hover:text-red-400 underline"
              >
                Esqueci a senha
              </Link>
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
            className={`mt-2 w-full rounded-full px-4 py-2 text-sm font-semibold transition ${
              carregando
                ? "cursor-wait bg-zinc-900 text-zinc-500"
                : "bg-red-600 text-white hover:bg-red-500"
            }`}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </button>
        </form>
  );
}

export default function LoginPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center px-6 py-12 text-zinc-100 overflow-x-hidden">
      {/* Imagem de fundo da página de Login */}
      <div
        className="fixed inset-0 z-0 bg-no-repeat bg-zinc-900 page-bg-image"
        style={{
          backgroundImage: "url(/login-bg.png.png)",
          ["--page-bg-size" as string]: "cover",
          ["--page-bg-position" as string]: "center center",
        }}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-md">
        <h1 className="mb-2 text-2xl text-center font-semibold">
          Entrar na THouse Rec
        </h1>

        <p className="mb-6 text-sm text-center text-zinc-400">
          Acesse sua conta para acompanhar agendamentos, planos e serviços.
        </p>

        <Suspense fallback={
          <div className="space-y-4 rounded-2xl border border-red-700/40 bg-zinc-900 p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-10 bg-zinc-800 rounded"></div>
              <div className="h-10 bg-zinc-800 rounded"></div>
              <div className="h-10 bg-zinc-800 rounded"></div>
            </div>
          </div>
        }>
          <LoginForm />
        </Suspense>

        <div className="mt-6 text-center space-y-3">
          <p className="text-sm text-white mb-2">
            Não possui uma conta?
          </p>
          <Link
            href="/registro"
            className="inline-block rounded-full bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-all"
          >
            Clique aqui para criar sua conta
          </Link>
          
          <div className="pt-4 border-t border-zinc-800">
            <Link
              href="/"
              className="inline-block text-xs text-zinc-400 hover:text-red-400 underline transition-colors"
            >
              ← Voltar para Home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
