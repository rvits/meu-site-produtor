"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

function VerificarPagamentoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"verificando" | "sucesso" | "pendente" | "erro">("verificando");
  const [mensagem, setMensagem] = useState("Verificando status do pagamento...");
  const paymentId = searchParams.get("paymentId");
  const tipo = searchParams.get("tipo") || "agendamento";

  useEffect(() => {
    if (!paymentId) {
      setStatus("erro");
      setMensagem("ID do pagamento não encontrado.");
      return;
    }

    // Verificar status do pagamento
    verificarPagamento(paymentId);
  }, [paymentId]);

  async function verificarPagamento(id: string) {
    try {
      const res = await fetch(`/api/pagamentos/verificar?paymentId=${id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === "RECEIVED" || data.status === "CONFIRMED") {
          setStatus("sucesso");
          setMensagem("Pagamento confirmado com sucesso!");
          // Redirecionar após 2 segundos
          setTimeout(() => {
            router.push(`/pagamentos/sucesso?tipo=${tipo}`);
          }, 2000);
        } else if (data.status === "PENDING") {
          setStatus("pendente");
          setMensagem("Pagamento ainda está sendo processado. Aguarde alguns instantes.");
        } else {
          setStatus("erro");
          setMensagem("Pagamento não foi confirmado. Entre em contato com o suporte.");
        }
      } else {
        setStatus("erro");
        setMensagem("Erro ao verificar pagamento. Tente novamente.");
      }
    } catch (error) {
      console.error("Erro ao verificar pagamento:", error);
      setStatus("erro");
      setMensagem("Erro ao verificar pagamento. Você pode acessar manualmente a página de sucesso.");
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-zinc-100">
      <div className="text-center">
        {status === "verificando" && (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/20 mb-4 animate-spin">
                <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-blue-400 mb-4">
                Verificando Pagamento...
              </h1>
            </div>
            <p className="text-zinc-300">{mensagem}</p>
          </>
        )}

        {status === "sucesso" && (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4">
                <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-green-400 mb-4">
                Pagamento Confirmado! 🎉
              </h1>
            </div>
            <p className="text-zinc-300 mb-4">{mensagem}</p>
            <p className="text-zinc-400 text-sm">Redirecionando...</p>
          </>
        )}

        {status === "pendente" && (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-yellow-500/20 mb-4">
                <svg className="w-10 h-10 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-yellow-400 mb-4">
                Pagamento Pendente
              </h1>
            </div>
            <p className="text-zinc-300 mb-4">{mensagem}</p>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => verificarPagamento(paymentId!)}
                className="rounded-full bg-yellow-600 px-6 py-3 font-semibold text-white hover:bg-yellow-500 transition-all"
              >
                Verificar Novamente
              </button>
              <Link
                href="/conta"
                className="rounded-full border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 hover:border-red-500 hover:text-red-300 transition-all"
              >
                Ver Minha Conta
              </Link>
            </div>
          </>
        )}

        {status === "erro" && (
          <>
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 mb-4">
                <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-red-400 mb-4">
                Erro ao Verificar
              </h1>
            </div>
            <p className="text-zinc-300 mb-4">{mensagem}</p>
            <div className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
              <p className="text-yellow-300 text-sm mb-2">
                ⚠️ Se você já realizou o pagamento, pode acessar manualmente:
              </p>
              <Link
                href={`/pagamentos/sucesso?tipo=${tipo}`}
                className="text-yellow-200 underline hover:text-yellow-100"
              >
                Página de Confirmação de Pagamento
              </Link>
            </div>
            <div className="flex flex-wrap gap-3 justify-center">
              <button
                onClick={() => verificarPagamento(paymentId!)}
                className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-500 transition-all"
              >
                Tentar Novamente
              </button>
              <Link
                href="/conta"
                className="rounded-full border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 hover:border-red-500 hover:text-red-300 transition-all"
              >
                Ver Minha Conta
              </Link>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

export default function VerificarPagamento() {
  return (
    <Suspense fallback={
      <main className="mx-auto max-w-xl px-6 py-16 text-zinc-100">
        <div className="text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/20 mb-4 animate-pulse">
              <div className="w-10 h-10 bg-blue-400 rounded"></div>
            </div>
            <h1 className="text-3xl font-bold text-blue-400 mb-4">
              Carregando...
            </h1>
          </div>
        </div>
      </main>
    }>
      <VerificarPagamentoContent />
    </Suspense>
  );
}
