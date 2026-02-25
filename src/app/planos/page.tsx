  "use client";

import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import DuvidasBox from "../components/DuvidasBox";

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
    mensal: 249.99,
    anual: 2499.90,
    descricao: "Para quem está começando a gravar com frequência.",
    beneficios: [
      { label: "1 sessão por mês", included: true },
      { label: "2h de captação por mês", included: true },
      { label: "1 Mix por mês", included: true },
      { label: "10% de desconto em serviços avulsos", included: true },
      { label: "Sem beats personalizados", included: false },
      { label: "Sem acesso a descontos promocionais", included: false },
      { label: "Não tem acompanhamento artístico", included: false },
    ],
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 449.99,
    anual: 4499.90,
    descricao: "Para artistas que gravam com regularidade e já possuem músicas próprias.",
    beneficios: [
      { label: "1 sessão por mês", included: true },
      { label: "2h de captação por mês", included: true },
      { label: "1 Mix & Master por mês", included: true },
      { label: "1 Beat por mês", included: true },
      { label: "Acesso a descontos promocionais do site", included: true },
      { label: "Não tem desconto em serviços ou beats", included: false },
      { label: "Não tem acompanhamento artístico", included: false },
    ],
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 799.99,
    anual: 7999.90,
    descricao: "Acompanhamento profissional contínuo com TremV e 2 Produções completas por mês.",
    beneficios: [
      { label: "2 sessões por mês", included: true },
      { label: "4h de captação por mês", included: true },
      { label: "2 Mix & Master por mês", included: true },
      { label: "2 Beats por mês", included: true },
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

    // Redirecionar para página de pagamentos com dados do plano
    const queryParams = new URLSearchParams({
      tipo: "plano",
      planId: plano.id,
      modo: modoPlano,
    });

    router.push(`/pagamentos?${queryParams.toString()}`);
  };

  return (
    <main className="relative mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-12 text-zinc-100 overflow-x-hidden">
      {/* Imagem de fundo da página de Planos */}
      <div
        className="fixed inset-0 z-0 bg-no-repeat bg-zinc-900 page-bg-image"
        style={{
          backgroundImage: "url(/planos-bg.png.png)",
          ["--page-bg-size" as string]: "cover",
          ["--page-bg-position" as string]: "center -8%",
        }}
        aria-hidden
      />
      <div className="relative z-10">
      {/* TÍTULO */}
      <section className="mb-8 flex flex-col items-center justify-center w-full">
        <h1 className="mb-3 text-center text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-semibold" style={{ textShadow: "0 4px 20px rgba(0, 0, 0, 0.8), 0 2px 10px rgba(239, 68, 68, 0.3)" }}>
          Planos da <span className="text-red-500">THouse Rec</span>
        </h1>
        
        {/* TEXTO DESCRITIVO SEM BOX */}
        <p className="mb-6 sm:mb-8 md:mb-10 text-center text-xs sm:text-sm md:text-base leading-relaxed text-zinc-300 px-2" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
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
                          const iconColor = b.included ? "bg-emerald-500" : "bg-red-600";
                          const textColor = b.included ? "text-emerald-200" : "text-red-300";
                          
                          return (
                            <li
                              key={idx}
                              className="flex items-center gap-2 rounded-lg px-4 py-2 bg-zinc-900"
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
                      className="mt-auto w-full rounded-full border border-red-600 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-600/20 transition-all"
                      style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
                    >
                      Assinar este plano
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* BOX DE TESTE - APENAS PARA ADMIN */}
      {user && (user.email === "thouse.rec.tremv@gmail.com" || user.role === "ADMIN") && (
        <section className="mb-16 flex justify-center px-4">
          <div className="relative w-full max-w-5xl border-2 border-yellow-500 rounded-2xl bg-yellow-950/20 backdrop-blur-sm p-6">
            <div className="text-center space-y-4">
              <h3 className="text-xl font-semibold text-yellow-400">
                🧪 Pagamento de Teste - Plano (Apenas Admin)
              </h3>
              <p className="text-sm text-yellow-200">
                Use esta opção para testar o fluxo de pagamento de PLANO com um valor de R$ 5,00.
                Um plano de teste será criado e aparecerá na seção "Planos" do admin após o pagamento.
              </p>
              <button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/test-payment", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ tipo: "plano" }),
                    });

                    if (!res.ok) {
                      const error = await res.json();
                      let errorMessage = error.error || "Erro ao criar pagamento de teste";
                      
                      // Mensagens mais amigáveis para erros comuns
                      if (error.details?.tipo === "permissao_insuficiente") {
                        errorMessage = `❌ Permissão Insuficiente\n\n${error.error}\n\n${error.details.solucao}\n\n${error.details.guia || ""}`;
                      } else if (error.details?.tipo === "token_invalido") {
                        errorMessage = `❌ Token Inválido\n\n${error.error}\n\n${error.details.solucao}`;
                      } else if (error.details?.tipo === "ambiente_invalido") {
                        errorMessage = `❌ Ambiente Inválido\n\n${error.error}\n\n${error.details.solucao}`;
                      }
                      
                      alert(errorMessage);
                      console.error("[Test Payment Frontend] Erro completo:", error);
                      return;
                    }

                    const data = await res.json();
                    if (data.initPoint) {
                      window.location.href = data.initPoint;
                    } else {
                      alert("Não foi possível obter o link de pagamento de teste.");
                    }
                  } catch (e) {
                    console.error(e);
                    alert("Erro inesperado ao iniciar pagamento de teste.");
                  }
                }}
                className="mt-4 w-full max-w-md mx-auto rounded-full bg-yellow-600 px-6 py-3 text-sm font-semibold text-white hover:bg-yellow-500 transition-all"
                style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.5)" }}
              >
                Testar Pagamento - R$ 5,00
              </button>
            </div>
          </div>
        </section>
      )}

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
            <p className="text-sm md:text-base leading-relaxed text-white mb-4 text-justify md:text-center px-2 md:px-0" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              Assinar um plano da THouse Rec é a forma mais inteligente de produzir
              com constância. Além do desconto financeiro, os planos oferecem
              prioridade na agenda e acompanhamento contínuo do seu projeto.
            </p>
            
            <p className="text-xs md:text-sm text-zinc-300 mt-4 text-justify md:text-center px-2 md:px-0" style={{ textShadow: "0 2px 8px rgba(0, 0, 0, 0.8)" }}>
              A contratação de qualquer plano está sujeita à confirmação do pagamento e ao aceite dos{" "}
              <a href="/termos-contratos" className="!text-blue-400 underline underline-offset-2 hover:!text-blue-300 transition-colors" style={{ color: '#60a5fa' }}>termos de uso</a>
              <span className="hidden md:inline"><br />e </span>
              <span className="md:hidden"> e </span>
              <a href="/termos-contratos" className="!text-blue-400 underline underline-offset-2 hover:!text-blue-300 transition-colors" style={{ color: '#60a5fa' }}>contrato de prestação de serviço</a> da THouse Rec.
            </p>
          </div>
        </div>
      </section>

      {/* BOX DE DÚVIDAS */}
      <DuvidasBox />
      </div>
    </main>
  );
}
