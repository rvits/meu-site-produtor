"use client";

import { useState } from "react";
import QuickActions from "./components/QuickActions";

type ChatMessage = {
  id: string;
  role: "user" | "ai" | "human" | "system";
  content: string;
};

type ChatMode = "ai" | "waiting_human" | "human";

export default function ChatPage() {
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
        body: JSON.stringify({ messages: updatedMessages }),
      });

      const data = await res.json();

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
    } catch {
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

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-zinc-100">
      <h1 className="mb-4 text-center text-2xl font-semibold">
        Suporte THouse Rec
      </h1>

      {/* CONTAINER PRINCIPAL */}
      <div className="flex h-[70vh] flex-col rounded-xl border border-zinc-800 bg-zinc-950">
        {/* HISTÓRICO */}
        <div className="flex-1 overflow-y-auto space-y-3 p-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
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
          <div className="border-t border-zinc-800 px-4 py-3">
            <QuickActions onSend={enviarMensagem} />
          </div>
        )}

        {/* INPUT */}
        <div className="flex gap-2 border-t border-zinc-800 p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-red-500"
          />

          <button
            onClick={() => enviarMensagem()}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold hover:bg-red-500"
          >
            Enviar
          </button>
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
