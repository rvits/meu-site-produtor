"use client";

import { useState } from "react";

export default function TestarEmailPage() {
  const [resultado, setResultado] = useState<any>(null);
  const [carregando, setCarregando] = useState(false);

  async function testarEmail() {
    setCarregando(true);
    setResultado(null);

    try {
      const res = await fetch("/api/test-email");
      const data = await res.json();
      setResultado(data);
    } catch (err: any) {
      setResultado({
        success: false,
        error: "Erro ao fazer requisição",
        details: { message: err.message },
      });
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12 text-zinc-100">
      <div className="w-full max-w-2xl">
        <h1 className="mb-6 text-3xl font-bold text-center">Teste de Email</h1>

        <button
          onClick={testarEmail}
          disabled={carregando}
          className={`w-full rounded-lg px-4 py-3 text-sm font-semibold transition ${
            carregando
              ? "cursor-wait bg-zinc-900 text-zinc-500"
              : "bg-red-600 text-white hover:bg-red-500"
          }`}
        >
          {carregando ? "Testando..." : "Testar Envio de Email"}
        </button>

        {resultado && (
          <div className="mt-6 rounded-lg border border-zinc-700 bg-zinc-900 p-6">
            <h2 className="mb-4 text-xl font-semibold">
              {resultado.success ? "✅ Sucesso" : "❌ Erro"}
            </h2>
            <pre className="overflow-auto rounded bg-zinc-950 p-4 text-xs text-zinc-300">
              {JSON.stringify(resultado, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
