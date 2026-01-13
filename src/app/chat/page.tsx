"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import QuickActions from "./components/QuickActions";

type ChatMessage = {
  id: string;
  role: "user" | "ai" | "human" | "system";
  content: string;
};

type ChatMode = "ai" | "waiting_human" | "human";

export default function ChatPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "ai",
      content:
        "Olá! 👋 Sou o suporte da THouse Rec. Posso te ajudar com preços, planos, agendamentos ou funcionamento do estúdio.",
    },
  ]);

  const [input, setInput] = useState("");
  const [chatMode, setChatMode] = useState<ChatMode>("ai");
  const [loading, setLoading] = useState(false);

  // 🔒 Verificar autenticação
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // ===============================
  // ENVIO ÚNICO (INPUT + BOTÕES)
  // ===============================
  function enviarMensagem(texto?: string) {
    const mensagem = (texto ?? input).trim();
    if (!mensagem) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: mensagem,
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");

    if (chatMode === "ai") {
      responderIA(updatedMessages);
    }
  }

  // ===============================
  // RESPOSTA DA IA
  // ===============================
  async function responderIA(updatedMessages: ChatMessage[]) {
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Incluir cookies para autenticação
        body: JSON.stringify({ messages: updatedMessages }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Erro na API do chat:", res.status, errorData);
        
        // Se não estiver autenticado, redirecionar para login
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        
        throw new Error(errorData.error || `Erro ${res.status}`);
      }

      const data = await res.json();

      if (!data.reply) {
        console.error("Resposta vazia da API:", data);
        throw new Error("Resposta vazia");
      }

      const respostaIA: ChatMessage = {
        id: crypto.randomUUID(),
        role: "ai",
        content: data.reply,
      };

      setMessages((prev) => [...prev, respostaIA]);

      if (
        data.reply ===
        "Vou chamar um atendente humano para te ajudar melhor com isso."
      ) {
        setChatMode("waiting_human");
      }
    } catch (error: any) {
      console.error("Erro ao responder IA:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "ai",
          content: "Tivemos um problema técnico. Pode tentar novamente?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ⏳ Mostrar loading enquanto verifica autenticação
  if (authLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-100">
        <div className="flex h-64 items-center justify-center text-zinc-400">
          Carregando...
        </div>
      </main>
    );
  }

  // 🔒 Se não estiver autenticado, não mostrar nada (redirecionará)
  if (!user) {
    return null;
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-100">
      <h1 className="mb-4 text-center text-2xl font-semibold">
        Suporte THouse Rec
      </h1>

      {/* CONTAINER PRINCIPAL */}
      <div className="relative w-full rounded-2xl border border-red-500 bg-zinc-950" style={{ borderWidth: "1px" }}>
        <div className="flex h-[70vh] flex-col">
          {/* HISTÓRICO */}
          <div className="chat-scroll flex-1 overflow-y-auto space-y-3 p-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "ml-auto bg-red-600 text-white"
                  : msg.role === "ai"
                  ? "bg-zinc-800 text-zinc-200"
                  : "bg-emerald-700 text-white"
              }`}
            >
              {msg.content}
            </div>
          ))}

          {loading && (
            <div className="text-xs text-zinc-400">
              Suporte digitando…
            </div>
          )}
        </div>

          {/* BOTÕES RÁPIDOS */}
          {chatMode === "ai" && (
            <div className="px-4 pt-3">
              <QuickActions onSend={enviarMensagem} />
            </div>
          )}

          {/* INPUT */}
          <div className="flex gap-2 p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviarMensagem();
                }
              }}
              placeholder="Digite sua mensagem..."
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-red-500 focus:bg-zinc-800 transition-all"
            />

            <button
              onClick={() => enviarMensagem()}
              className="rounded-lg bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 transition-all"
              style={{ textShadow: "0 2px 4px rgba(0, 0, 0, 0.8)" }}
            >
              Enviar
            </button>
          </div>
        </div>
      </div>

      {/* STATUS HUMANO */}
      {chatMode === "waiting_human" && (
        <div className="mt-3 rounded-lg border border-yellow-600 bg-yellow-900/30 px-4 py-2 text-center text-xs text-yellow-300">
          👤 Um atendente humano foi acionado. Aguarde um momento.
        </div>
      )}
    </main>
  );
}
