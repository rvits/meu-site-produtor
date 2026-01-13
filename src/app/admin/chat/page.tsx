"use client";

import { useEffect, useState } from "react";

interface ChatMessage {
  id: string;
  senderType: string;
  content: string;
  createdAt: string;
}

interface ChatSession {
  id: string;
  status: string;
  humanRequested: boolean;
  adminAccepted: boolean;
  user: {
    nomeArtistico: string;
    email: string;
  };
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

export default function AdminChatPage() {
  const [sessoes, setSessoes] = useState<ChatSession[]>([]);
  const [sessaoAtual, setSessaoAtual] = useState<ChatSession | null>(null);
  const [novaMensagem, setNovaMensagem] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarSessoes();
    const interval = setInterval(carregarSessoes, 5000); // Atualizar a cada 5s
    return () => clearInterval(interval);
  }, []);

  async function carregarSessoes() {
    try {
      const res = await fetch("/api/admin/chat");
      if (res.ok) {
        const data = await res.json();
        setSessoes(data.sessions || []);
      }
    } catch (err) {
      console.error("Erro ao carregar sessões", err);
    } finally {
      setLoading(false);
    }
  }

  async function aceitarSolicitacao(sessionId: string) {
    try {
      const res = await fetch(`/api/admin/chat?action=accept`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatSessionId: sessionId }),
      });

      if (res.ok) {
        await carregarSessoes();
        if (sessaoAtual?.id === sessionId) {
          const data = await res.json();
          setSessaoAtual(data.session);
        }
      }
    } catch (err) {
      console.error("Erro ao aceitar solicitação", err);
    }
  }

  async function enviarMensagem() {
    if (!sessaoAtual || !novaMensagem.trim()) return;

    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatSessionId: sessaoAtual.id,
          content: novaMensagem,
        }),
      });

      if (res.ok) {
        setNovaMensagem("");
        await carregarSessoes();
        // Atualizar sessão atual
        const s = sessoes.find((s) => s.id === sessaoAtual.id);
        if (s) setSessaoAtual(s);
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem", err);
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando chat...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Chat Admin</h1>
        <p className="text-zinc-400">Atender solicitações humanas e responder usuários</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Sessões */}
        <div className="lg:col-span-1 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-300">Sessões de Chat</h2>
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {sessoes.map((s) => (
              <div
                key={s.id}
                onClick={() => setSessaoAtual(s)}
                className={`rounded-lg border p-4 cursor-pointer transition ${
                  sessaoAtual?.id === s.id
                    ? "border-red-500 bg-red-500/10"
                    : "border-zinc-700 bg-zinc-800/50 hover:border-zinc-600"
                }`}
              >
                <div className="font-medium text-zinc-100">{s.user.nomeArtistico}</div>
                <div className="text-xs text-zinc-400">{s.user.email}</div>
                <div className="mt-2 flex gap-2 flex-wrap">
                  {s.humanRequested && (
                    <span className="rounded px-2 py-1 text-xs font-semibold bg-orange-500/20 text-orange-300">
                      Solicitação Humana
                    </span>
                  )}
                  {s.adminAccepted && (
                    <span className="rounded px-2 py-1 text-xs font-semibold bg-green-500/20 text-green-300">
                      Aceito
                    </span>
                  )}
                  <span className="rounded px-2 py-1 text-xs font-semibold bg-blue-500/20 text-blue-300">
                    {s.messages.length} msgs
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Ativo */}
        <div className="lg:col-span-2 space-y-4">
          {sessaoAtual ? (
            <>
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-100">{sessaoAtual.user.nomeArtistico}</h3>
                    <p className="text-sm text-zinc-400">{sessaoAtual.user.email}</p>
                  </div>
                  {sessaoAtual.humanRequested && !sessaoAtual.adminAccepted && (
                    <button
                      onClick={() => aceitarSolicitacao(sessaoAtual.id)}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500"
                    >
                      Aceitar Solicitação
                    </button>
                  )}
                </div>

                {/* Mensagens */}
                <div className="space-y-3 max-h-[400px] overflow-y-auto mb-4">
                  {sessaoAtual.messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg p-3 ${
                        msg.senderType === "admin"
                          ? "bg-red-600/20 ml-auto max-w-[80%]"
                          : msg.senderType === "user"
                          ? "bg-zinc-700/50 mr-auto max-w-[80%]"
                          : "bg-blue-600/20 mr-auto max-w-[80%]"
                      }`}
                    >
                      <p className="text-sm text-zinc-100">{msg.content}</p>
                      <p className="text-xs text-zinc-400 mt-1">
                        {new Date(msg.createdAt).toLocaleString("pt-BR")}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Input de Mensagem */}
                {sessaoAtual.adminAccepted && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={novaMensagem}
                      onChange={(e) => setNovaMensagem(e.target.value)}
                      onKeyPress={(e) => e.key === "Enter" && enviarMensagem()}
                      className="flex-1 rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100"
                      placeholder="Digite sua mensagem..."
                    />
                    <button
                      onClick={enviarMensagem}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500"
                    >
                      Enviar
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-12 text-center text-zinc-400">
              Selecione uma sessão de chat para começar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
