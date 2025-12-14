"use client";

export default function ShoppingPage() {
  return (
    <main className="flex min-h-[calc(100vh-80px)] items-center justify-center px-10 text-zinc-100">
      <div className="w-full max-w-6xl space-y-10 text-center">
        {/* TÍTULO */}
        <h1 className="text-4xl font-semibold text-red-500 md:text-6xl">
          Shopping em desenvolvimento
        </h1>

        {/* TEXTO PRINCIPAL */}
        <p className="text-base leading-relaxed text-zinc-300 md:text-lg">
          Esta área está sendo construída para receber o shopping oficial da
          THouse Rec. Em breve, você poderá adquirir beats exclusivos, packs,
          serviços digitais, conteúdos especiais e outras novidades diretamente
          por aqui.
        </p>

        {/* TEXTO COMPLEMENTAR */}
        <p className="text-base leading-relaxed text-zinc-400 md:text-lg">
          Estamos preparando tudo com calma para garantir uma experiência
          organizada, segura e alinhada com a proposta criativa do estúdio.
        </p>

        {/* OBSERVAÇÃO */}
        <p className="pt-6 text-sm text-zinc-500">
          (Em breve: uma imagem nada séria do VT com um machado ou picareta 🪓😄)
        </p>
      </div>
    </main>
  );
}
