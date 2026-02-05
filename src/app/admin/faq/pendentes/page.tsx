"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";

interface Pergunta {
  id: string;
  question: string;
  userName: string | null;
  userEmail: string | null;
  userId: string | null;
  answer: string | null;
  answeredAt: string | null;
  answeredBy: string | null;
  published: boolean;
  status: string;
  createdAt: string;
  user: {
    id: string;
    nomeCompleto: string;
    nomeArtistico: string;
    email: string;
    telefone: string;
  } | null;
}

export default function AdminFaqPendentesPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [perguntas, setPerguntas] = useState<Pergunta[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondendoId, setRespondendoId] = useState<string | null>(null);
  const [resposta, setResposta] = useState("");
  const [mensagem, setMensagem] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "ADMIN")) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user && user.role === "ADMIN") {
      carregarPerguntas();
    }
  }, [user]);

  async function carregarPerguntas() {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/faq/pendentes");
      if (res.ok) {
        const data = await res.json();
        setPerguntas(data.perguntas || []);
      }
    } catch (err) {
      console.error("Erro ao carregar perguntas:", err);
    } finally {
      setLoading(false);
    }
  }

  async function responderPergunta(questionId: string) {
    if (!resposta.trim()) {
      setMensagem("A resposta é obrigatória");
      return;
    }

    try {
      setMensagem(null);
      const res = await fetch("/api/admin/faq/responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          answer: resposta,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMensagem("Pergunta respondida com sucesso!");
        setRespondendoId(null);
        setResposta("");
        carregarPerguntas();
      } else {
        setMensagem(data.error || "Erro ao responder pergunta");
      }
    } catch (err) {
      setMensagem("Erro ao responder pergunta");
    }
  }

  async function publicarPergunta(questionId: string, publish: boolean) {
    try {
      const res = await fetch("/api/admin/faq/publicar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          publish,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setMensagem(publish ? "Pergunta publicada no FAQ!" : "Pergunta removida do FAQ");
        carregarPerguntas();
      } else {
        setMensagem(data.error || "Erro ao publicar pergunta");
      }
    } catch (err) {
      setMensagem("Erro ao publicar pergunta");
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-900 text-zinc-100">
        <p>Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-red-500">Perguntas Pendentes do FAQ</h1>
          <button
            onClick={() => router.push("/admin/faq")}
            className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
          >
            Voltar para FAQ
          </button>
        </div>

        {mensagem && (
          <div className={`mb-4 p-4 rounded-lg ${
            mensagem.includes("sucesso") || mensagem.includes("publicada")
              ? "bg-green-900/30 text-green-300 border border-green-700"
              : "bg-red-900/30 text-red-300 border border-red-700"
          }`}>
            {mensagem}
          </div>
        )}

        {perguntas.length === 0 ? (
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-8 text-center">
            <p className="text-zinc-400">Nenhuma pergunta pendente no momento.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {perguntas.map((pergunta) => (
              <div
                key={pergunta.id}
                className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6"
              >
                <div className="mb-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-zinc-100">Pergunta</h3>
                    <span className="px-3 py-1 bg-orange-500/20 text-orange-300 rounded-full text-xs font-semibold">
                      Pendente
                    </span>
                  </div>
                  <p className="text-zinc-300 whitespace-pre-wrap">{pergunta.question}</p>
                </div>

                <div className="mb-4 p-4 bg-zinc-900/50 rounded-lg">
                  <h4 className="text-sm font-semibold text-zinc-400 mb-2">Informações do Usuário</h4>
                  <div className="space-y-1 text-sm text-zinc-300">
                    <p><strong>Nome:</strong> {pergunta.userName || pergunta.user?.nomeArtistico || pergunta.user?.nomeCompleto || "Não informado"}</p>
                    <p><strong>Email:</strong> {pergunta.userEmail || pergunta.user?.email || "Não informado"}</p>
                    {pergunta.user?.telefone && (
                      <p><strong>Telefone:</strong> {pergunta.user.telefone}</p>
                    )}
                    {pergunta.userId && (
                      <p><strong>ID do Usuário:</strong> {pergunta.userId}</p>
                    )}
                    <p><strong>Data:</strong> {new Date(pergunta.createdAt).toLocaleString("pt-BR")}</p>
                  </div>
                </div>

                {respondendoId === pergunta.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-2">
                        Resposta
                      </label>
                      <textarea
                        value={resposta}
                        onChange={(e) => setResposta(e.target.value)}
                        placeholder="Digite a resposta para esta pergunta..."
                        rows={6}
                        className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm text-zinc-100 focus:border-red-500 focus:outline-none resize-none"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => responderPergunta(pergunta.id)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      >
                        Enviar Resposta
                      </button>
                      <button
                        onClick={() => {
                          setRespondendoId(null);
                          setResposta("");
                        }}
                        className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setRespondendoId(pergunta.id);
                        setResposta("");
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                      Responder Pergunta
                    </button>
                  </div>
                )}

                {pergunta.answer && (
                  <div className="mt-4 p-4 bg-green-900/20 border border-green-700 rounded-lg">
                    <h4 className="text-sm font-semibold text-green-400 mb-2">Resposta</h4>
                    <p className="text-zinc-300 whitespace-pre-wrap">{pergunta.answer}</p>
                    <div className="mt-2 flex gap-2">
                      {!pergunta.published && (
                        <button
                          onClick={() => publicarPergunta(pergunta.id, true)}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors text-sm"
                        >
                          Publicar no FAQ
                        </button>
                      )}
                      {pergunta.published && (
                        <button
                          onClick={() => publicarPergunta(pergunta.id, false)}
                          className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors text-sm"
                        >
                          Remover do FAQ
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
