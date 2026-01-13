"use client";

import { useState } from "react";

export default function ShoppingPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const categories = [
    { id: "beats", name: "Beats Exclusivos", icon: "🎵" },
    { id: "roupas", name: "Peças de Roupa", icon: "👕" },
    { id: "eventos", name: "Próximos Eventos", icon: "📅" },
    { id: "promocoes", name: "Promoções Especiais", icon: "🎁" },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 text-zinc-100">
      {/* TÍTULO PRINCIPAL */}
      <section className="mb-8 text-center">
        <h1 className="text-3xl md:text-4xl font-bold mb-4" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
          Shopping THouse Rec
        </h1>
        <p className="text-sm md:text-base text-zinc-300 max-w-2xl mx-auto" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
          Adquira beats exclusivos, packs especiais, serviços digitais e conteúdos únicos diretamente do estúdio.
        </p>
      </section>

      {/* BOX PRINCIPAL - EM DESENVOLVIMENTO */}
      <section className="mb-12 flex justify-center px-4">
        <div className="relative w-full max-w-5xl border border-red-500 rounded-2xl" style={{ borderWidth: "1px" }}>
          <div
            className="relative p-6 md:p-10 rounded-2xl"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div className="text-center space-y-6">
              <div className="inline-block text-6xl mb-4">🚧</div>
              
              <h2 className="text-2xl md:text-3xl font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                Shopping em Desenvolvimento
              </h2>
              
              <div className="space-y-4 text-sm md:text-base leading-relaxed" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
                <p className="text-white">
                  Estamos preparando uma experiência completa de compra para você. Em breve, você poderá adquirir:
                </p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                  {categories.map((category) => (
                    <div
                      key={category.id}
                      className={`p-4 rounded-lg border transition-all cursor-pointer ${
                        selectedCategory === category.id
                          ? "border-red-500 bg-red-600/20"
                          : "border-zinc-700 bg-zinc-900/30 hover:border-red-500/60"
                      }`}
                      onClick={() => setSelectedCategory(selectedCategory === category.id ? null : category.id)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{category.icon}</span>
                        <span className="font-semibold text-white">{category.name}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-zinc-700 mt-8">
                <p className="text-xs md:text-sm text-zinc-400 italic" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
                  Estamos trabalhando para garantir uma experiência organizada, segura e alinhada com a proposta criativa do estúdio.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INFORMAÇÕES ADICIONAIS */}
      <section className="mb-8 flex justify-center px-4">
        <div className="relative w-full max-w-4xl border border-red-500 rounded-2xl" style={{ borderWidth: "1px" }}>
          <div
            className="relative p-6 md:p-8 rounded-2xl"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <div className="text-center space-y-4">
              <h3 className="text-lg md:text-xl font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
                Enquanto isso...
              </h3>
              
              <div className="space-y-3 text-sm md:text-base text-white" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
                <p>
                  Você já pode agendar sessões de estúdio, contratar serviços de produção e assinar nossos planos mensais.
                </p>
                <p className="text-zinc-300">
                  Acesse a página de <a href="/agendamento" className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors">Agendamento</a> ou confira nossos <a href="/planos" className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors">Planos</a> para começar a produzir agora mesmo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
