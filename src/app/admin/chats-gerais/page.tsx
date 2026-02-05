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

export default function AdminChatsGeraisPage() {
  const [sessoes, setSessoes] = useState<ChatSession[]>([]);
  const [sessoesFiltradas, setSessoesFiltradas] = useState<ChatSession[]>([]);
  const [sessaoAtual, setSessaoAtual] = useState<ChatSession | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "respondidos">("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarSessoes();
    const interval = setInterval(carregarSessoes, 60000); // Atualizar a cada 1 minuto
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let filtradas = sessoes;

    // Aplicar filtro de respondidos
    if (filtro === "respondidos") {
      filtradas = filtradas.filter((s) => s.adminAccepted || s.messages.some((m) => m.senderType === "admin"));
    }

    // Aplicar busca
    if (busca.trim() !== "") {
      const termo = busca.toLowerCase();
      filtradas = filtradas.filter(
        (s) =>
          s.user.nomeArtistico.toLowerCase().includes(termo) ||
          s.user.email.toLowerCase().includes(termo)
      );
    }

    setSessoesFiltradas(filtradas);
  }, [busca, filtro, sessoes]);

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

  async function carregarSessao(sessionId: string) {
    try {
      const res = await fetch(`/api/admin/chat?sessionId=${sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSessaoAtual(data.session);
      }
    } catch (err) {
      console.error("Erro ao carregar sessão", err);
    }
  }

  async function excluirChat(sessionId: string) {
    if (!confirm("Tem certeza que deseja excluir este chat? Esta ação não pode ser desfeita.")) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/chat?action=delete&sessionId=${sessionId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await carregarSessoes();
        if (sessaoAtual?.id === sessionId) {
          setSessaoAtual(null);
        }
        alert("Chat excluído com sucesso!");
      } else {
        const data = await res.json();
        alert(data.error || "Erro ao excluir chat");
      }
    } catch (err) {
      console.error("Erro ao excluir chat", err);
      alert("Erro ao excluir chat. Tente novamente.");
    }
  }

  const chatsRespondidos = sessoes.filter(
    (s) => s.adminAccepted || s.messages.some((m) => m.senderType === "admin")
  );

  if (loading) {
    return <p className="text-zinc-400">Carregando chats...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Chats Gerais e Respondidos</h1>
        <p className="text-zinc-400">Visualize todas as conversas dos usuários, incluindo chats respondidos</p>
      </div>

      {/* Filtros e Busca */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 space-y-4">
        <div className="flex gap-4">
          <button
            onClick={() => setFiltro("todos")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              filtro === "todos"
                ? "bg-red-600 text-white"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            Todos os Chats ({sessoes.length})
          </button>
          <button
            onClick={() => setFiltro("respondidos")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              filtro === "respondidos"
                ? "bg-green-600 text-white"
                : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
            }`}
          >
            Chats Respondidos ({chatsRespondidos.length})
          </button>
        </div>

        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou email do usuário..."
          className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:border-red-500 focus:outline-none"
        />
        {busca && (
          <p className="text-sm text-zinc-400">
            {sessoesFiltradas.length} chat(s) encontrado(s)
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Chats */}
        <div className="space-y-2">
          {sessoesFiltradas.length === 0 ? (
            <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6 text-center text-zinc-400">
              Nenhum chat encontrado.
            </div>
          ) : (
            sessoesFiltradas.map((s) => {
              const temRespostaAdmin = s.messages.some((m) => m.senderType === "admin");
              return (
                <div
                  key={s.id}
                  className={`rounded-lg border p-4 cursor-pointer transition ${
                    sessaoAtual?.id === s.id
                      ? "border-red-500 bg-red-500/10"
                      : "border-zinc-700 bg-zinc-800/50 hover:border-red-500/50"
                  }`}
                  onClick={() => carregarSessao(s.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-zinc-100">{s.user.nomeArtistico}</div>
                      <div className="text-xs text-zinc-400">{s.user.email}</div>
                      <div className="text-xs text-zinc-500 mt-1">
                        {s.messages.length} mensagens •{" "}
                        {new Date(s.updatedAt).toLocaleDateString("pt-BR")}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {temRespostaAdmin && (
                        <div className="w-3 h-3 rounded-full bg-green-500" title="Respondido" />
                      )}
                      {s.humanRequested && !s.adminAccepted && (
                        <div className="w-3 h-3 rounded-full bg-orange-500" title="Pendente" />
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Visualização de Chat */}
        <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
          {sessaoAtual ? (
            <div className="space-y-4 h-[70vh] flex flex-col">
              <div className="pb-4 border-b border-zinc-700 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-zinc-100">{sessaoAtual.user.nomeArtistico}</h3>
                  <p className="text-xs text-zinc-400">{sessaoAtual.user.email}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    {sessaoAtual.messages.length} mensagens • Criado em{" "}
                    {new Date(sessaoAtual.createdAt).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                <button
                  onClick={() => excluirChat(sessaoAtual.id)}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition"
                  title="Excluir chat"
                >
                  🗑️ Excluir
                </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                {sessaoAtual.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                      msg.senderType === "user"
                        ? "ml-auto bg-red-600 text-white"
                        : msg.senderType === "admin"
                        ? "bg-emerald-700 text-white"
                        : "bg-zinc-800 text-zinc-200"
                    }`}
                  >
                    {msg.content}
                    <div className="text-xs opacity-70 mt-1">
                      {new Date(msg.createdAt).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-[70vh] items-center justify-center text-zinc-400">
              Selecione um chat para visualizar
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
