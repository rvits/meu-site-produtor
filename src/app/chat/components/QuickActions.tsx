"use client";

type QuickActionsProps = {
  onSend: (text: string) => void;
};

export default function QuickActions({ onSend }: QuickActionsProps) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      <button
        onClick={() => onSend("Quais são os preços?")}
        className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-red-500 hover:text-red-300"
      >
        Preços
      </button>

      <button
        onClick={() => onSend("Como funciona o agendamento?")}
        className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-red-500 hover:text-red-300"
      >
        Agendamento
      </button>

      <button
        onClick={() => onSend("Quais planos vocês oferecem?")}
        className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-red-500 hover:text-red-300"
      >
        Planos
      </button>

      <button
        onClick={() => onSend("Quais serviços vocês fazem no estúdio?")}
        className="rounded-full border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:border-red-500 hover:text-red-300"
      >
        Serviços
      </button>

      <button
        onClick={() => onSend("Quero falar com um atendente humano")}
        className="rounded-full border border-red-600 px-4 py-2 text-sm text-red-400 hover:bg-red-600/10"
      >
        Atendimento humano
      </button>
    </div>
  );
}
