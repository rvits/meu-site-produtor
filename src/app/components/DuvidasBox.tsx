"use client";

import Link from "next/link";

export default function DuvidasBox() {
  return (
    <section className="mb-16 flex justify-center">
      <div className="relative w-full max-w-5xl mx-auto border border-red-500 rounded-2xl overflow-hidden" style={{ borderWidth: "1px" }}>
        <div
          className="relative space-y-4 p-6 md:p-8 rounded-2xl"
          style={{
            background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
          }}
        >
          <h2 className="text-lg text-center font-semibold text-red-400" style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}>
            Ficou com alguma dúvida?
          </h2>

          <p className="text-sm text-center text-white md:text-base" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
            Se ainda restar alguma dúvida sobre sessões, prazos, valores ou questões técnicas, você pode consultar o FAQ ou falar diretamente com o suporte pelo chat. Estamos aqui para te ajudar a tirar o máximo proveito de cada sessão.
          </p>

          <div className="flex flex-wrap justify-center gap-4 text-sm">
            <Link
              href="/faq"
              className="rounded-full border border-red-600 px-6 py-3 text-sm font-semibold text-red-300 hover:border-red-400 hover:text-red-200 hover:bg-red-600/10 transition-all"
              style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
            >
              Ver FAQ
            </Link>

            <Link
              href="/chat"
              className="rounded-full border border-red-600 px-6 py-3 text-sm font-semibold text-red-300 hover:border-red-400 hover:text-red-200 hover:bg-red-600/10 transition-all"
              style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
            >
              Suporte via Chat
            </Link>

            <Link
              href="/contato"
              className="rounded-full border border-red-600 px-6 py-3 text-sm font-semibold text-red-300 hover:border-red-400 hover:text-red-200 hover:bg-red-600/10 transition-all"
              style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
            >
              Contato direto
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
