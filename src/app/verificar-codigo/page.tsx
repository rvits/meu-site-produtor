"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerificarCodigoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";

  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    setCarregando(true);

    if (!email) {
      setErro("Email não encontrado. Por favor, solicite a recuperação novamente.");
      setCarregando(false);
      return;
    }

    if (codigo.length !== 6) {
      setErro("O código deve ter 6 dígitos.");
      setCarregando(false);
      return;
    }

    try {
      const res = await fetch("/api/verificar-codigo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: codigo }),
      });

      const data = await res.json();
      setCarregando(false);

      if (!res.ok) {
        setErro(data.error || "Código inválido ou expirado.");
        return;
      }

      // Redirecionar para página de troca de senha
      router.push(`/trocar-senha?email=${encodeURIComponent(email)}&token=${data.token}`);
    } catch (err) {
      setCarregando(false);
      setErro("Erro ao verificar código. Tente novamente.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 text-zinc-100">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl text-center font-semibold">
          Verificação de Código
        </h1>

        <p className="mb-6 text-sm text-center text-zinc-400">
          Enviamos um código de verificação para <strong>{email}</strong>.
          <br />
          Por favor, verifique sua caixa de entrada e digite o código abaixo.
        </p>

        <div className="mb-6 rounded-lg border border-yellow-600 bg-yellow-500 p-4">
          <p className="text-xs text-black">
            <strong>Instruções:</strong>
          </p>
          <ol className="mt-2 ml-4 list-decimal space-y-1 text-xs text-black">
            <li>Acesse sua caixa de entrada do email <strong>{email}</strong></li>
            <li>Procure pelo email da THouse Rec com o assunto "Código de Recuperação de Senha"</li>
            <li>Copie o código de 6 dígitos que está no email</li>
            <li>Cole o código no campo abaixo</li>
            <li>Clique em "Verificar Código"</li>
          </ol>
          <p className="mt-3 text-xs text-black">
            ⚠️ <strong>Importante:</strong> O código expira em 15 minutos.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-red-700/40 bg-zinc-900 p-6"
        >
          <div className="space-y-1">
            <label className="text-xs text-zinc-300">Código de Verificação</label>
            <input
              type="text"
              required
              value={codigo}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCodigo(value);
              }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-center text-2xl font-mono tracking-widest outline-none focus:border-red-500"
              placeholder="000000"
              maxLength={6}
            />
            <p className="text-xs text-zinc-500 mt-1">
              Digite o código de 6 dígitos enviado por email
            </p>
          </div>

          {erro && (
            <p className="rounded bg-red-950/40 px-3 py-2 text-xs text-red-400">
              {erro}
            </p>
          )}

          <button
            type="submit"
            disabled={carregando || codigo.length !== 6}
            className={`w-full rounded-full border border-red-600 px-4 py-2 text-sm font-semibold transition ${
              carregando || codigo.length !== 6
                ? "cursor-wait bg-red-600/50 text-white border-red-600"
                : "bg-red-600 text-white hover:bg-red-500"
            }`}
          >
            {carregando ? "Verificando..." : "Verificar Código"}
          </button>
        </form>

        <div className="mt-6 text-center space-y-2">
          <Link
            href="/esqueci-senha"
            className="block text-xs text-zinc-400 hover:text-red-400 underline"
          >
            Solicitar novo código
          </Link>
          <Link
            href="/login"
            className="block text-xs text-zinc-400 hover:text-red-400 underline"
          >
            Voltar para login
          </Link>
        </div>
      </div>
    </main>
  );
}
