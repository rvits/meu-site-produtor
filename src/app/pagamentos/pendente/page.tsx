"use client";

export default function PagamentoPendentePage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-zinc-100">
      <h1 className="mb-4 text-2xl font-semibold text-yellow-400">
        Pagamento pendente
      </h1>

      <p className="mb-3 text-sm text-zinc-300">
        Seu pagamento ainda está sendo processado pelo sistema.
      </p>

      <p className="mb-6 text-sm text-zinc-300">
        Assim que for confirmado, você receberá acesso ao serviço adquirido.
        Se já pagou, aguarde alguns minutos e atualize a página.
      </p>

      <a
        href="/"
        className="rounded-full bg-yellow-600 px-5 py-2 text-sm font-semibold text-white hover:bg-yellow-500"
      >
        Voltar para o início
      </a>
    </main>
  );
}
