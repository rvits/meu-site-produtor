"use client";

import { useEffect, useState } from "react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  views?: number;
  createdAt?: string;
}

const QUICK_TOPICS = [
  "pagamento",
  "agendamento",
  "planos",
  "Pix",
  "login",
  "erro",
];

// Função para capitalizar primeira letra de cada palavra
const capitalizeWords = (str: string) => {
  return str
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
};

export default function FAQPage() {
  const [query, setQuery] = useState("");
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [frequentFaqs, setFrequentFaqs] = useState<FAQ[]>([]);
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [allFaqs, setAllFaqs] = useState<FAQ[]>([]);
  const [totalFaqs, setTotalFaqs] = useState(0);
  const [loadingAll, setLoadingAll] = useState(false);

  const [userQuestion, setUserQuestion] = useState("");
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [askMessage, setAskMessage] = useState<string | null>(null);
  const [askLoading, setAskLoading] = useState(false);

  // Buscar FAQs na API
  async function fetchFaqs(term: string) {
    try {
      setLoading(true);
      const url = term
        ? `/api/faq/search?q=${encodeURIComponent(term)}`
        : "/api/faq/search";

      console.log("Buscando FAQs com termo:", term, "URL:", url);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error("Erro ao buscar FAQs");
      }
      const data = await res.json();
      let allFaqs: FAQ[] = data.faqs || [];
      console.log("FAQs encontradas:", allFaqs.length);

      // SEM busca -> exclui FAQs frequentes e mostra 8 principais diferentes
      if (!term) {
        const frequentIds = frequentFaqs.map(f => f.id);
        allFaqs = allFaqs.filter(faq => !frequentIds.includes(faq.id));
        console.log("FAQs após excluir frequentes:", allFaqs.length);
      }

      // SEM busca -> mostra só 8 principais (já filtradas)
      // COM busca -> mostra tudo
      const filtered = term ? allFaqs : allFaqs.slice(0, 8);
      setFaqs(filtered);
      console.log("FAQs filtradas para exibição:", filtered.length);
    } catch (e) {
      console.error("Erro ao buscar FAQs:", e);
    } finally {
      setLoading(false);
    }
  }

  // Buscar FAQs mais frequentes (já ordenadas por views pela API)
  async function fetchFrequentFaqs() {
    try {
      console.log("Buscando FAQs frequentes...");
      const res = await fetch("/api/faq/search?limit=5");
      console.log("Resposta da API de FAQs frequentes:", res.status, res.ok);
      if (res.ok) {
        const data = await res.json();
        console.log("Dados recebidos:", data);
        const frequent = (data.faqs || []).slice(0, 5);
        console.log("FAQs frequentes processadas:", frequent.length, frequent);
        setFrequentFaqs(frequent);
      } else {
        const errorText = await res.text();
        console.error("Erro ao buscar FAQs frequentes:", res.status, errorText);
      }
    } catch (e) {
      console.error("Erro ao buscar FAQs frequentes:", e);
    }
  }

  // Buscar todas as FAQs
  async function fetchAllFaqs() {
    try {
      setLoadingAll(true);
      console.log("Buscando todas as FAQs...");
      const res = await fetch("/api/faq/search?limit=50");
      if (res.ok) {
        const data = await res.json();
        const all = data.faqs || [];
        console.log("Todas as FAQs recebidas:", all.length);
        setAllFaqs(all);
        setTotalFaqs(all.length);
        setShowAllFaqs(true);
      } else {
        console.error("Erro ao buscar todas as FAQs:", res.status);
      }
    } catch (e) {
      console.error("Erro ao buscar todas as FAQs:", e);
    } finally {
      setLoadingAll(false);
    }
  }

  // Buscar apenas o total de FAQs (sem carregar todas)
  async function fetchTotalFaqs() {
    try {
      const res = await fetch("/api/faq/search?limit=50");
      if (res.ok) {
        const data = await res.json();
        const all = data.faqs || [];
        setTotalFaqs(all.length);
      }
    } catch (e) {
      console.error("Erro ao buscar total de FAQs:", e);
    }
  }

  // Carregar FAQs iniciais
  useEffect(() => {
    console.log("🔄 Carregando FAQs iniciais...");
    fetchFrequentFaqs();
    fetchTotalFaqs();
    // FAQs serão carregadas quando as frequentes mudarem (via useEffect)
  }, []);

  // Atualizar FAQs quando a query mudar
  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchFaqs(query);
    }, 400);

    return () => clearTimeout(timeout);
  }, [query]);

  // Recarregar perguntas frequentes quando a query for limpa
  useEffect(() => {
    if (!query.trim()) {
      fetchFrequentFaqs();
    }
  }, [query]);

  // Recarregar FAQs quando as frequentes mudarem (para excluir as frequentes)
  useEffect(() => {
    if (!query.trim() && frequentFaqs.length > 0) {
      fetchFaqs("");
    }
  }, [frequentFaqs]);

  async function handleAsk(e: React.FormEvent) {
    e.preventDefault();
    setAskMessage(null);

    // Validar nome
    if (!userName.trim()) {
      setAskMessage("O nome é obrigatório.");
      return;
    }

    // Validar email
    if (!userEmail.trim()) {
      setAskMessage("O e-mail é obrigatório.");
      return;
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userEmail.trim())) {
      setAskMessage("Por favor, insira um e-mail válido.");
      return;
    }

    // Validar pergunta
    if (!userQuestion.trim()) {
      setAskMessage("A pergunta é obrigatória.");
      return;
    }

    if (userQuestion.trim().length < 10) {
      setAskMessage("Descreva sua dúvida com pelo menos 10 caracteres.");
      return;
    }

    setAskLoading(true);
    try {
      const res = await fetch("/api/faq/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: userQuestion,
          userName,
          userEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao enviar dúvida");
      }

      setAskMessage(
        "Dúvida enviada com sucesso! Ela será analisada e poderá aparecer aqui em breve."
      );
      setUserQuestion("");
      setUserName("");
      setUserEmail("");
    } catch (e: any) {
      console.error(e);
      setAskMessage(
        e?.message ||
          "Erro ao enviar sua dúvida. Tente novamente em alguns instantes."
      );
    } finally {
      setAskLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10 text-zinc-100">
      {/* TÍTULO + TEXTO INTRODUTÓRIO */}
      <section className="mb-7">
        <h1 className="text-4xl text-center md:text-5xl font-bold text-zinc-100">
          Suporte / Ouvidoria / FAQ
        </h1>
        <p className="mt-4 text-center text-sm md:text-base text-zinc-300">
          Aqui você encontra respostas para dúvidas frequentes sobre
          agendamentos, planos, pagamentos, produção musical e uso do site.
          Você também pode enviar sua própria pergunta para que a equipe da
          THouse Rec — e a comunidade — ajudem a construir uma base de
          conhecimento cada vez mais completa.
        </p>
      </section>

      {/* BUSCA + ATALHOS */}
      <section className="mb-8">
        <label className="mb-2 block text-xs text-center font-semibold uppercase tracking-wide text-zinc-400">
          Buscar por dúvida, erro ou palavra-chave
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ex: pagamento, agendamento, Pix, plano Prata, login..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm outline-none focus:border-red-500"
        />

        <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
          {QUICK_TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              onClick={() => setQuery(topic)}
              className="rounded-full border border-zinc-600 bg-black/80 px-3 py-1 text-zinc-300 hover:border-red-500 hover:text-red-300 transition-all"
              style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)" }}
            >
              {capitalizeWords(topic)}
            </button>
          ))}
        </div>
      </section>

      {/* PERGUNTAS FREQUENTES - Mostrar apenas quando não há busca ativa */}
      {!query.trim() && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-200">
              {frequentFaqs.length > 0 ? "Perguntas Frequentes" : ""}
            </h2>
            {frequentFaqs.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  console.log("🔄 Recarregando FAQs frequentes...");
                  fetchFrequentFaqs();
                }}
                className="rounded-full border border-zinc-600 bg-zinc-800/50 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 hover:border-zinc-500 transition-all"
                style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)" }}
              >
                Recarregar
              </button>
            )}
          </div>
          {frequentFaqs.length > 0 ? (
            <>
              <div className="space-y-3">
                {frequentFaqs.map((faq) => (
                  <div key={faq.id} className="max-w-6xl">
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                      className="w-full rounded-lg border border-zinc-700 bg-black/80 px-4 py-3 text-left text-sm text-zinc-200 hover:border-red-500 hover:bg-black/90 transition-all"
                      style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)" }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex-1 pr-2 text-left">{faq.question}</span>
                        <span className="text-xs text-zinc-400">
                          {expandedFaq === faq.id ? "▼" : "▶"}
                        </span>
                      </div>
                    </button>
                    {expandedFaq === faq.id && (
                      <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-950/90 p-4 text-sm text-zinc-300 leading-relaxed text-left">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="text-center text-sm text-zinc-400 mb-4">
                Nenhuma pergunta frequente encontrada. Clique no botão abaixo para ver todas as perguntas disponíveis.
              </p>
              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    console.log("🔄 Recarregando FAQs frequentes...");
                    fetchFrequentFaqs();
                  }}
                  className="rounded-full border border-zinc-600 bg-zinc-800/50 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 hover:border-zinc-500 transition-all"
                  style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)" }}
                >
                  Recarregar
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {/* LISTA DE FAQS */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">
          {query.trim() ? `Resultados para "${query}"` : "Respostas rápidas"}
        </h2>

        {loading && (
          <p className="text-xs text-zinc-400 mb-4">
            Carregando respostas...
          </p>
        )}

        {!loading && query.trim() && faqs.length === 0 && (
          <p className="text-sm text-zinc-400">
            Não encontramos nenhuma resposta com o termo "{query}". Tente usar outras palavras-chave ou verifique a ortografia.
          </p>
        )}

        {!loading && !query.trim() && faqs.length === 0 && (
          <p className="text-sm text-zinc-400">
            Nenhuma pergunta encontrada no banco de dados. Execute o seed para popular o banco: <code className="bg-zinc-800 px-2 py-1 rounded">npm run seed</code>
          </p>
        )}

        <div className="space-y-3">
          {faqs.map((faq) => (
            <div key={faq.id} className="max-w-6xl">
              <button
                type="button"
                onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                className="w-full rounded-lg border border-zinc-700 bg-black/80 px-4 py-3 text-left text-sm text-zinc-200 hover:border-red-500 hover:bg-black/90 transition-all"
                style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="flex-1 pr-2 text-left">{faq.question}</span>
                  <span className="text-xs text-zinc-400">
                    {expandedFaq === faq.id ? "▼" : "▶"}
                  </span>
                </div>
              </button>
              {expandedFaq === faq.id && (
                <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-950/90 p-4 text-sm text-zinc-300 leading-relaxed text-left">
                  {faq.answer}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Seção de todas as perguntas - Sempre visível, conteúdo toggle */}
      <section className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-200">
            Todas as Perguntas ({totalFaqs || allFaqs.length || 0})
          </h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                console.log("🔄 Recarregando FAQs frequentes...");
                fetchFrequentFaqs();
              }}
              className="rounded-full border border-zinc-600 bg-zinc-800/50 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-700 hover:border-zinc-500 transition-all"
              style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)" }}
            >
              Recarregar
            </button>
            <button
              type="button"
              onClick={() => {
                if (showAllFaqs) {
                  setShowAllFaqs(false);
                } else {
                  if (allFaqs.length === 0) {
                    fetchAllFaqs();
                  } else {
                    setShowAllFaqs(true);
                  }
                }
              }}
              disabled={loadingAll}
              className="rounded-full border border-red-600 bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingAll ? "Carregando..." : showAllFaqs ? "Ocultar todas as perguntas" : "Mostrar todas as perguntas"}
            </button>
          </div>
        </div>
        
        {showAllFaqs && (
          <>
            {loadingAll ? (
              <p className="text-sm text-zinc-400">Carregando todas as perguntas...</p>
            ) : allFaqs.length === 0 ? (
              <p className="text-sm text-zinc-400">
                Nenhuma pergunta encontrada no banco de dados. Execute o seed: <code className="bg-zinc-800 px-2 py-1 rounded">npm run seed</code>
              </p>
            ) : (
              <div className="space-y-3">
                {allFaqs.map((faq) => (
                  <div key={faq.id} className="max-w-6xl">
                    <button
                      type="button"
                      onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                      className="w-full rounded-lg border border-zinc-700 bg-black/80 px-4 py-3 text-left text-sm text-zinc-200 hover:border-red-500 hover:bg-black/90 transition-all"
                      style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)" }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="flex-1 pr-2 text-left">{faq.question}</span>
                        <span className="text-xs text-zinc-400">
                          {expandedFaq === faq.id ? "▼" : "▶"}
                        </span>
                      </div>
                    </button>
                    {expandedFaq === faq.id && (
                      <div className="mt-2 rounded-lg border border-zinc-700 bg-zinc-950/90 p-4 text-sm text-zinc-300 leading-relaxed text-left">
                        {faq.answer}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>

      {/* OUVIDORIA */}
      <section className="mb-4 rounded-2xl border border-zinc-700 bg-zinc-950/70 p-5">
        <h2 className="mb-3 text-xl md:text-2xl font-semibold text-center">
          Não achou sua resposta? Envie sua dúvida.
        </h2>

        <form onSubmit={handleAsk} className="space-y-3 text-sm">
          <div className="grid gap-3 md:grid-cols-2">
            <input
              type="text"
              placeholder="Seu nome"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              required
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
            <input
              type="email"
              placeholder="Seu e-mail"
              value={userEmail}
              onChange={(e) => setUserEmail(e.target.value)}
              required
              className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
            />
          </div>

          <textarea
            rows={4}
            value={userQuestion}
            onChange={(e) => setUserQuestion(e.target.value)}
            placeholder="Explique sua dúvida com detalhes..."
            required
            className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2"
          />

          {askMessage && (
            <p className={`text-xs text-center ${
              askMessage.includes("sucesso") 
                ? "text-green-400" 
                : "text-red-400"
            }`}>
              {askMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={askLoading}
            className={`w-full rounded-full px-6 py-3 font-semibold transition-all ${
              askLoading
                ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                : "bg-red-600 text-white hover:bg-red-500"
            }`}
          >
            {askLoading ? "Enviando..." : "Enviar dúvida"}
          </button>
        </form>
      </section>
    </main>
  );
}
