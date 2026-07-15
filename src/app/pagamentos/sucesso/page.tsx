"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { useDomainSync } from "@/app/lib/synchronization/DomainSyncProvider";

function SucessoContent() {
  const searchParams = useSearchParams();
  const isTeste = searchParams.get("teste") === "true";
  const tipo = searchParams.get("tipo"); // "agendamento" ou "plano"
  const operationId = searchParams.get("operationId");
  const { connected, lastEvent } = useDomainSync();
  const [confirmado, setConfirmado] = useState(false);

  useEffect(() => {
    if (
      lastEvent?.name !== "PaymentConfirmed" ||
      lastEvent.metadata?.effectsReady !== true ||
      !operationId ||
      lastEvent.metadata?.operationId !== operationId
    ) {
      return;
    }
    setConfirmado(true);
    const redirect = setTimeout(() => {
      window.location.href = "/minha-conta";
    }, 1200);
    return () => clearTimeout(redirect);
  }, [lastEvent, operationId]);

  if (!confirmado) {
    return (
      <main className="mx-auto max-w-xl px-6 py-16 text-zinc-100">
        <div className="text-center">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/20 mb-4 animate-spin">
              <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-blue-400 mb-4">
              Aguardando confirmação
            </h1>
          </div>
          <p className="text-zinc-300">
            O pagamento foi iniciado. Esta página será atualizada automaticamente quando o
            Asaas confirmar a operação.
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            Sincronização {connected ? "conectada" : "reconectando…"}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-zinc-100">
      <div className="text-center">
        <div className="mb-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-500/20 mb-4">
            <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-green-400 mb-4">
            Pagamento Aprovado! 🎉
          </h1>
        </div>
        
        {isTeste && (
          <div className="mb-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg">
            <p className="text-yellow-300 text-sm">
              ⚠️ Este foi um pagamento de teste (R$ 5,00)
            </p>
          </div>
        )}
        
        <div className="mb-6 p-6 rounded-xl border border-green-500/30 bg-green-500/10 backdrop-blur-sm">
          {tipo === "agendamento" || !tipo ? (
            <>
              <p className="text-lg font-semibold text-green-300 mb-3">
                Obrigado por agendar sua sessão com a THouse Rec!
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed">
                Seu pagamento foi concluído com sucesso. Aguarde a confirmação do agendamento pelo seu email.
              </p>
            </>
          ) : tipo === "plano" ? (
            <>
              <p className="text-lg font-semibold text-green-300 mb-3">
                Plano Ativado com Sucesso! 🎉
              </p>
              <p className="text-zinc-300 text-sm leading-relaxed">
                Seu pagamento foi concluído com sucesso. Seu plano foi ativado e os cupons de serviços já estão disponíveis na sua conta.
                {!isTeste && " Você receberá um email de confirmação em breve."}
              </p>
            </>
          ) : (
            <p className="text-lg font-semibold text-green-300 mb-3">
              Pagamento Aprovado!
            </p>
          )}
        </div>
        
        {!operationId && (
          <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
            <p className="text-blue-300 text-sm">
              💡 <strong>Dica:</strong> Se você não foi redirecionado automaticamente após o pagamento, não se preocupe! 
              O pagamento foi processado e você receberá um email de confirmação em breve.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/"
            className="rounded-full bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-500 transition-all shadow-lg hover:shadow-red-500/50"
          >
            Retornar ao Site
          </Link>
          <Link
            href="/minha-conta"
            className="rounded-full border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 hover:border-red-500 hover:text-red-300 transition-all"
          >
            Ver Minha Conta
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function Sucesso() {
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
      <SucessoContent />
    </Suspense>
  );
}
