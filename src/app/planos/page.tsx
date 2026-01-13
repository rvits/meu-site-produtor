  "use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

// =========================================================
// TIPOS
// =========================================================
type Plano = {
  id: string;
  nome: string;
  mensal: number;
  anual: number;
  descricao: string;
  beneficios: { label: string; included: boolean; useTilde?: boolean }[];
};

// =========================================================
// DADOS FIXOS
// =========================================================
const PLANOS: Plano[] = [
  {
    id: "bronze",
    nome: "Plano Bronze",
    mensal: 149.99,
    anual: 1499.99,
    descricao: "Para quem está começando a gravar com frequência.",
    beneficios: [
      { label: "2h de captação por mês", included: true },
      { label: "1 Mix & Master", included: true },
      { label: "10% de desconto em serviços avulsos", included: true },
      { label: "Sem beats personalizados", included: false },
      { label: "Sem acesso a descontos promocionais", included: false },
      { label: "Não possui acompanhamento artístico", included: false },
    ],
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 349.99,
    anual: 3499.99,
    descricao: "Para artistas que gravam com regularidade e já possuem músicas próprias.",
    beneficios: [
      { label: "2h de captação por mês", included: true },
      { label: "2 Mix & Master por mês", included: true },
      { label: "1 Beat por mês", included: true },
      { label: "Acesso a descontos promocionais do site", included: true },
      { label: "Prioridade intermediária", included: true, useTilde: true },
      { label: "Não tem desconto em serviços ou beats", included: false },
      { label: "Não tem acompanhamento artístico", included: false },
    ],
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 549.99,
    anual: 5499.99,
    descricao: "Acompanhamento profissional contínuo com TremV e 1 Produção completa por mês.",
    beneficios: [
      { label: "4 horas de captação por mês", included: true },
      { label: "2 mix & master por mês", included: true },
      { label: "2 Beat", included: true },
      { label: "Desconto de 10% em serviços avulsos", included: true },
      { label: "Desconto de 10% em beats", included: true },
      { label: "Acesso a descontos promocionais do site", included: true },
      { label: "Acompanhamento artístico", included: true },
    ],
  },
];

// =========================================================
// COMPONENTE
// =========================================================
export default function PlanosPage() {
  const [mounted, setMounted] = useState(false);
  const [modoPlano, setModoPlano] = useState<"mensal" | "anual">("mensal");
  const [loadingPlanoId, setLoadingPlanoId] = useState<string | null>(null);
  const [aceiteTermos, setAceiteTermos] = useState<Record<string, boolean>>({
    bronze: false,
    prata: false,
    ouro: false,
  });

  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleAssinar = async (plano: Plano) => {
    if (!user) {
      alert("Você precisa estar logado para assinar um plano.");
      router.push("/login");
      return;
    }

    if (!aceiteTermos[plano.id]) {
      alert("É preciso marcar a declaração dos Termos de Contrato antes de assinar o plano.");
      return;
    }

    try {
      setLoadingPlanoId(plano.id);

      const resp = await fetch("/api/pagamentos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planoId: plano.id,
          modo: modoPlano,
          userId: user.id,
          nome: user.nome,
          email: user.email,
        }),
      });

      const data = await resp.json();
      window.location.href = data.init_point;
    } catch (err) {
      alert("Erro ao iniciar o pagamento.");
    } finally {
      setLoadingPlanoId(null);
    }
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-12 text-zinc-100">
      {/* TÍTULO */}
      <section className="mb-8 flex flex-col items-center justify-center w-full">
        <h1 className="mb-3 text-center text-3xl font-semibold md:text-5xl lg:text-6xl" style={{ textShadow: "0 4px 20px rgba(0, 0, 0, 0.8), 0 2px 10px rgba(239, 68, 68, 0.3)" }}>
          Planos da <span className="text-red-500">THouse Rec</span>
        </h1>
        
        {/* TEXTO DESCRITIVO SEM BOX */}
        <p className="mb-10 text-center text-sm leading-relaxed text-zinc-300 md:text-base mb-4" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
          Escolha o plano que melhor se encaixa na sua rotina de lançamentos.
        </p>

        {/* TOGGLE - BEM PRÓXIMO DO TEXTO */}
        <div className="flex justify-center items-center px-4 w-full mb-3">
          <div className="inline-flex rounded-full border border-red-700/60 bg-zinc-900 p-1">
            <button
              onClick={() => setModoPlano("mensal")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                modoPlano === "mensal"
                  ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                  : "text-zinc-300 hover:text-red-300 hover:bg-black/40"
              }`}
            >
              Mensal
            </button>
            <button
              onClick={() => setModoPlano("anual")}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                modoPlano === "anual"
                  ? "bg-red-600 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]"
                  : "text-zinc-300 hover:text-red-300 hover:bg-black/40"
              }`}
            >
              Anual
            </button>
          </div>
        </div>
      </section>

      {/* PLANOS */}
      <section className="mb-16 flex justify-center px-4">
        <div className="relative w-full max-w-5xl">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:items-stretch">
            {PLANOS.map((plano) => {
              const valorBase =
                modoPlano === "mensal" ? plano.mensal : plano.anual;

              const precoFormatado =
                modoPlano === "mensal"
                  ? `R$ ${valorBase.toFixed(2).replace(".", ",")} / mês`
                  : `R$ ${valorBase.toFixed(2).replace(".", ",")} / ano`;

              const borderColor = plano.id === "bronze" 
                ? "border-amber-600/80" 
                : plano.id === "prata" 
                ? "border-gray-400/80" 
                : "border-yellow-400/80";
              const hoverBorderColor = plano.id === "bronze"
                ? "hover:border-amber-500"
                : plano.id === "prata"
                ? "hover:border-gray-300"
                : "hover:border-yellow-300";

              return (
                <div
                  key={plano.id}
                  className={`flex h-full flex-col rounded-2xl border ${borderColor} bg-black/50 backdrop-blur-sm p-6 transition-all ${hoverBorderColor} hover:bg-black/70`}
                  style={{ 
                    textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)", 
                    borderWidth: "1px",
                    boxShadow: plano.id === "bronze" 
                      ? "0 0 20px rgba(217, 119, 6, 0.4), 0 0 10px rgba(217, 119, 6, 0.2)"
                      : plano.id === "prata"
                      ? "0 0 20px rgba(156, 163, 175, 0.4), 0 0 10px rgba(156, 163, 175, 0.2)"
                      : "0 0 20px rgba(234, 179, 8, 0.4), 0 0 10px rgba(234, 179, 8, 0.2)"
                  }}
                >
                  <div className="flex flex-col h-full">
                    <div className="flex-1 flex flex-col">
                      <div className="space-y-6">
                        <h3 className="text-center text-lg font-semibold">
                          {plano.id === "bronze" ? (
                            <span className="text-amber-600">Plano Bronze</span>
                          ) : plano.id === "prata" ? (
                            <span className="text-gray-400">Plano Prata</span>
                          ) : plano.id === "ouro" ? (
                            <span className="text-yellow-400">Plano Ouro</span>
                          ) : (
                            <span className="text-red-300">{plano.nome}</span>
                          )}
                        </h3>

                        <p className="text-center text-2xl font-bold text-red-400">
                          {precoFormatado}
                        </p>

                        <p className="text-center text-xs text-zinc-400">
                          {plano.descricao}
                        </p>
                      </div>

                      <ul className="mt-10 space-y-2 mb-6 text-xs text-zinc-200">
                        {plano.beneficios.map((b, idx) => {
                          const useTilde = b.useTilde && b.included;
                          const isPriorityIntermediate = b.label === "Prioridade intermediária" && b.included;
                          const iconColor = b.included 
                            ? (isPriorityIntermediate ? "bg-yellow-500" : "bg-emerald-500") 
                            : "bg-red-600";
                          const textColor = b.included 
                            ? (isPriorityIntermediate ? "text-yellow-200" : "text-emerald-200") 
                            : "text-red-300";
                          const boxBgColor = isPriorityIntermediate ? "bg-yellow-950/40" : "bg-zinc-900";
                          const boxBorderColor = isPriorityIntermediate ? "border-yellow-500/60" : "";
                          
                          return (
                            <li
                              key={idx}
                              className={`flex items-center gap-2 rounded-lg px-4 py-2 ${boxBgColor} ${boxBorderColor} ${boxBorderColor ? "border" : ""}`}
                            >
                              <span
                                className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${iconColor} text-black`}
                              >
                                {useTilde ? "~" : (b.included ? "✓" : "✕")}
                              </span>
                              <span className={b.included ? textColor : "text-red-300"}>
                                {b.label}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>

                    {/* CHECKBOX DE ACEITE DOS TERMOS */}
                    <div className="mb-4 flex items-center justify-center gap-2">
                      <input
                        type="checkbox"
                        id={`aceite-termos-${plano.id}`}
                        checked={aceiteTermos[plano.id]}
                        onChange={(e) => setAceiteTermos(prev => ({ ...prev, [plano.id]: e.target.checked }))}
                        className="h-4 w-4 cursor-pointer rounded border-zinc-600 bg-zinc-900 text-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-0"
                      />
                      <label
                        htmlFor={`aceite-termos-${plano.id}`}
                        className="text-xs text-white cursor-pointer"
                        style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}
                      >
                        Declaro estar ciente dos{" "}
                        <a
                          href="/termos-contratos"
                          className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors"
                        >
                          termos de contrato
                        </a>
                      </label>
                    </div>

                    <button
                      onClick={() => handleAssinar(plano)}
                      disabled={loadingPlanoId === plano.id}
                      className="mt-auto w-full rounded-full border border-red-600 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-600/20 disabled:opacity-50 transition-all"
                      style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
                    >
                      {loadingPlanoId === plano.id
                        ? "Redirecionando..."
                        : "Assinar este plano"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TEXTO FINAL */}
      <section className="mb-16 flex justify-center px-4">
        <div className="relative w-full max-w-5xl border border-red-500 rounded-2xl" style={{ borderWidth: "1px" }}>
          <div
            className="relative p-6 md:p-8 rounded-2xl"
            style={{
              background: "linear-gradient(to right, rgba(0,0,0,0) 0%, rgba(0,0,0,0.75) 8%, rgba(0,0,0,0.85) 20%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,0.75) 92%, rgba(0,0,0,0) 100%)",
              backdropFilter: "blur(16px)",
              WebkitBackdropFilter: "blur(16px)",
            }}
          >
            <p className="text-center text-sm leading-relaxed text-white md:text-base mb-4" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Assinar um plano da THouse Rec é a forma mais inteligente de produzir
              com constância. Além do desconto financeiro, os planos oferecem
              prioridade na agenda e acompanhamento contínuo do seu projeto.
            </p>
            
            <p className="text-center text-xs text-zinc-300 mt-4" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              A contratação de qualquer plano está sujeita à confirmação do pagamento e
              ao aceite dos <a href="/termos-contratos" className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors">termos de uso</a> e <a href="/termos-contratos" className="text-blue-400 underline underline-offset-2 hover:text-blue-300 transition-colors">contrato de prestação de serviço</a> da THouse Rec.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
