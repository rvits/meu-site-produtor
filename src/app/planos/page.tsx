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
  beneficios: { label: string; included: boolean }[];
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
      { label: "1h de captação por mês", included: true },
      { label: "1 mix por mês", included: true },
      { label: "1 master por mês", included: true },
      { label: "Prioridade na agenda", included: false },
      { label: "Sessão de direção de produção", included: false },
      { label: "Desconto em beats exclusivos", included: false },
    ],
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 349.99,
    anual: 3499.99,
    descricao: "Para artistas que lançam com regularidade.",
    beneficios: [
      { label: "2h de captação por mês", included: true },
      { label: "2 mix & master por mês", included: true },
      { label: "1 beat por mês", included: true },
      { label: "Prioridade intermediária na agenda", included: true },
      { label: "Sessão de direção de produção", included: false },
      { label: "Desconto em beats exclusivos", included: false },
    ],
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 549.99,
    anual: 5499.99,
    descricao: "Para quem quer acompanhamento contínuo com o Tremv.",
    beneficios: [
      { label: "4h de captação por mês", included: true },
      { label: "2 produções completas por mês", included: true },
      { label: "2 beats por mês", included: true },
      { label: "Prioridade máxima na agenda", included: true },
      { label: "Sessão de direção de produção", included: true },
      { label: "Desconto em beats exclusivos", included: true },
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
      <header className="mb-20 text-center">
        <h1 className="text-4xl md:text-5xl font-bold">
          Planos da <span className="text-red-500">THouse Rec</span>
        </h1>
        <p className="mt-6 max-w-5xl mx-auto text-zinc-300">
          Escolha o plano que melhor se encaixa na sua rotina de lançamentos.
        </p>
      </header>

      {/* TOGGLE */}
      <section className="mb-10 flex justify-center">
        <div className="inline-flex rounded-full border border-red-700/60 bg-zinc-900 p-1">
          <button
            onClick={() => setModoPlano("mensal")}
            className={`px-5 py-2 rounded-full text-sm font-semibold ${
              modoPlano === "mensal"
                ? "bg-red-600 text-white"
                : "text-zinc-300"
            }`}
          >
            Mensal
          </button>
          <button
            onClick={() => setModoPlano("anual")}
            className={`px-5 py-2 rounded-full text-sm font-semibold ${
              modoPlano === "anual"
                ? "bg-red-600 text-white"
                : "text-zinc-300"
            }`}
          >
            Anual
          </button>
        </div>
      </section>

      {/* PLANOS */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {PLANOS.map((plano) => {
          const valor =
            modoPlano === "mensal" ? plano.mensal : plano.anual;

          return (
            <div
              key={plano.id}
              className="flex flex-col justify-between rounded-2xl border border-red-700/40 bg-zinc-900 p-6"
            >
              <div className="space-y-3">
                <h2 className="text-center text-lg font-semibold text-red-300">
                  {plano.nome}
                </h2>
                <p className="text-center text-2xl font-bold text-red-400">
                  R$ {valor.toFixed(2).replace(".", ",")}
                </p>
                <p className="text-center text-xs text-zinc-400">
                  {plano.descricao}
                </p>
              </div>

              <ul className="mt-6 space-y-2 text-sm">
                {plano.beneficios.map((b, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 rounded-lg bg-zinc-800/60 px-3 py-2"
                  >
                    <span
                      className={`h-4 w-4 flex items-center justify-center rounded-full text-[10px] font-bold ${
                        b.included
                          ? "bg-emerald-500 text-black"
                          : "bg-red-600 text-black"
                      }`}
                    >
                      {b.included ? "✓" : "✕"}
                    </span>
                    <span
                      className={
                        b.included
                          ? "text-emerald-200"
                          : "text-red-300 line-through"
                      }
                    >
                      {b.label}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleAssinar(plano)}
                disabled={loadingPlanoId === plano.id}
                className="mt-6 w-full rounded-full border border-red-600 px-5 py-3 text-sm font-semibold text-red-300 hover:bg-red-600/20 disabled:opacity-50"
              >
                {loadingPlanoId === plano.id
                  ? "Redirecionando..."
                  : "Assinar este plano"}
              </button>
            </div>
          );
        })}
      </section>

      {/* TEXTO FINAL */}
      <section className="mt-24 mb-20 max-w-5xl mx-auto text-center space-y-6">
        <p className="text-lg text-zinc-200">
          Assinar um plano da THouse Rec é a forma mais inteligente de produzir
          com constância. Além do desconto financeiro, os planos oferecem
          prioridade na agenda e acompanhamento contínuo do seu projeto.
        </p>
      </section>

      <p className="text-center text-xs text-zinc-400 max-w-3xl mx-auto">
        A contratação de qualquer plano está sujeita à confirmação do pagamento e
        ao aceite dos termos de uso e contrato de prestação de serviço da THouse
        Rec.
      </p>
    </main>
  );
}
