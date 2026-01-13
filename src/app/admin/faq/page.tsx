"use client";

import { useEffect, useState } from "react";

interface FAQ {
  id: string;
  question: string;
  answer: string;
  views: number;
  userQuestions: {
    id: string;
    question: string;
    userName?: string;
    userEmail?: string;
    blocked: boolean;
    createdAt: string;
  }[];
  createdAt: string;
}

export default function AdminFaqPage() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [novaPergunta, setNovaPergunta] = useState("");
  const [novaResposta, setNovaResposta] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);

  useEffect(() => {
    carregarFAQs();
  }, []);

  async function carregarFAQs() {
    try {
      const res = await fetch("/api/admin/faq");
      if (res.ok) {
        const data = await res.json();
        setFaqs(data.faqs || []);
      }
    } catch (err) {
      console.error("Erro ao carregar FAQs", err);
    } finally {
      setLoading(false);
    }
  }

  async function criarFAQ() {
    if (!novaPergunta || !novaResposta) return;

    try {
      const res = await fetch("/api/admin/faq", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: novaPergunta, answer: novaResposta }),
      });

      if (res.ok) {
        setNovaPergunta("");
        setNovaResposta("");
        setMostrarForm(false);
        await carregarFAQs();
      }
    } catch (err) {
      console.error("Erro ao criar FAQ", err);
    }
  }

  async function deletarFAQ(id: string) {
    if (!confirm("Tem certeza que deseja deletar esta FAQ?")) return;

    try {
      const res = await fetch(`/api/admin/faq?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await carregarFAQs();
      }
    } catch (err) {
      console.error("Erro ao deletar FAQ", err);
    }
  }

  async function bloquearComentario(id: string, blocked: boolean) {
    try {
      const res = await fetch(`/api/admin/faq?commentId=${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blocked }),
      });

      if (res.ok) {
        await carregarFAQs();
      }
    } catch (err) {
      console.error("Erro ao bloquear comentário", err);
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando FAQs...</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100 mb-2">FAQ</h1>
          <p className="text-zinc-400">Gerenciar perguntas frequentes e comentários</p>
        </div>
        <button
          onClick={() => setMostrarForm(!mostrarForm)}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
        >
          {mostrarForm ? "Cancelar" : "+ Nova FAQ"}
        </button>
      </div>

      {mostrarForm && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-zinc-100">Criar Nova FAQ</h3>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">Pergunta</label>
            <input
              type="text"
              value={novaPergunta}
              onChange={(e) => setNovaPergunta(e.target.value)}
              className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100"
              placeholder="Digite a pergunta"
            />
          </div>
          <div className="space-y-2">
            <label className="block text-sm font-medium text-zinc-300">Resposta</label>
            <textarea
              value={novaResposta}
              onChange={(e) => setNovaResposta(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100"
              placeholder="Digite a resposta"
            />
          </div>
          <button
            onClick={criarFAQ}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
          >
            Criar FAQ
          </button>
        </div>
      )}

      <div className="space-y-4">
        {faqs.map((faq) => (
          <div key={faq.id} className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">{faq.question}</h3>
                <p className="text-sm text-zinc-300">{faq.answer}</p>
                <div className="mt-2 text-xs text-zinc-400">
                  👁️ {faq.views} visualizações • {faq.userQuestions.length} comentários
                </div>
              </div>
              <button
                onClick={() => deletarFAQ(faq.id)}
                className="rounded px-3 py-1 text-xs font-semibold bg-red-600 text-white hover:bg-red-500"
              >
                Deletar
              </button>
            </div>

            {faq.userQuestions.length > 0 && (
              <div className="mt-4 pt-4 border-t border-zinc-700">
                <h4 className="text-sm font-semibold text-zinc-300 mb-2">Comentários:</h4>
                <div className="space-y-2">
                  {faq.userQuestions.map((cq) => (
                    <div
                      key={cq.id}
                      className={`rounded-lg p-3 text-sm ${
                        cq.blocked ? "bg-red-950/20 border border-red-500/30" : "bg-zinc-900/50"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <p className="text-zinc-200">{cq.question}</p>
                          {cq.userName && (
                            <p className="text-xs text-zinc-400 mt-1">
                              {cq.userName} {cq.userEmail && `(${cq.userEmail})`}
                            </p>
                          )}
                          <p className="text-xs text-zinc-500 mt-1">
                            {new Date(cq.createdAt).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <button
                          onClick={() => bloquearComentario(cq.id, !cq.blocked)}
                          className={`rounded px-2 py-1 text-xs font-semibold ${
                            cq.blocked
                              ? "bg-green-600 text-white hover:bg-green-500"
                              : "bg-red-600 text-white hover:bg-red-500"
                          }`}
                        >
                          {cq.blocked ? "Liberar" : "Bloquear"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {faqs.length === 0 && (
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
          Nenhuma FAQ encontrada. Crie a primeira!
        </div>
      )}
    </div>
  );
}
