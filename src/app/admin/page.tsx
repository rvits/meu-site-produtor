"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  appointments: number;
  users: number;
  payments: number;
  activePlans: number;
  services: number;
  pendingChats: number;
};

const MENU_ITEMS = [
  {
    id: "agendamentos",
    title: "Agendamentos",
    description: "Controlar sessões e horários",
    icon: "📅",
    href: "/admin/agendamentos",
    color: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
    hoverColor: "hover:from-blue-500/30 hover:to-blue-600/30",
  },
  {
    id: "usuarios",
    title: "Usuários",
    description: "Gerenciar clientes e logins",
    icon: "👥",
    href: "/admin/usuarios",
    color: "from-purple-500/20 to-purple-600/20 border-purple-500/30",
    hoverColor: "hover:from-purple-500/30 hover:to-purple-600/30",
  },
  {
    id: "pagamentos",
    title: "Pagamentos",
    description: "Visualizar transações",
    icon: "💰",
    href: "/admin/pagamentos",
    color: "from-green-500/20 to-green-600/20 border-green-500/30",
    hoverColor: "hover:from-green-500/30 hover:to-green-600/30",
  },
  {
    id: "planos",
    title: "Planos",
    description: "Assinaturas ativas",
    icon: "⭐",
    href: "/admin/planos",
    color: "from-yellow-500/20 to-yellow-600/20 border-yellow-500/30",
    hoverColor: "hover:from-yellow-500/30 hover:to-yellow-600/30",
  },
  {
    id: "servicos",
    title: "Serviços",
    description: "Serviços selecionados e aceitos",
    icon: "🎵",
    href: "/admin/servicos",
    color: "from-pink-500/20 to-pink-600/20 border-pink-500/30",
    hoverColor: "hover:from-pink-500/30 hover:to-pink-600/30",
  },
  {
    id: "faq",
    title: "FAQ",
    description: "Gerenciar perguntas e comentários",
    icon: "❓",
    href: "/admin/faq",
    color: "from-cyan-500/20 to-cyan-600/20 border-cyan-500/30",
    hoverColor: "hover:from-cyan-500/30 hover:to-cyan-600/30",
  },
  {
    id: "chat",
    title: "Chat",
    description: "Atendimento e solicitações humanas",
    icon: "💬",
    href: "/admin/chat",
    color: "from-red-500/20 to-red-600/20 border-red-500/30",
    hoverColor: "hover:from-red-500/30 hover:to-red-600/30",
  },
  {
    id: "reset-senha",
    title: "Resetar Senha",
    description: "Verificar usuários e resetar senhas",
    icon: "🔑",
    href: "/admin/reset-senha",
    color: "from-orange-500/20 to-orange-600/20 border-orange-500/30",
    hoverColor: "hover:from-orange-500/30 hover:to-orange-600/30",
  },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("Erro ao buscar stats:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-zinc-100 mb-2">Painel Admin</h1>
        <p className="text-zinc-400">Gerencie todos os aspectos da THouse Rec</p>
      </div>

      {/* Stats Cards */}
      {!loading && stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="text-2xl font-bold text-red-400">{stats.appointments}</div>
            <div className="text-xs text-zinc-400 mt-1">Agendamentos</div>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="text-2xl font-bold text-red-400">{stats.users}</div>
            <div className="text-xs text-zinc-400 mt-1">Usuários</div>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="text-2xl font-bold text-red-400">{stats.payments}</div>
            <div className="text-xs text-zinc-400 mt-1">Pagamentos</div>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="text-2xl font-bold text-red-400">{stats.activePlans}</div>
            <div className="text-xs text-zinc-400 mt-1">Planos Ativos</div>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="text-2xl font-bold text-red-400">{stats.services}</div>
            <div className="text-xs text-zinc-400 mt-1">Serviços</div>
          </div>
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="text-2xl font-bold text-red-400">{stats.pendingChats}</div>
            <div className="text-xs text-zinc-400 mt-1">Chats Pendentes</div>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {MENU_ITEMS.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={`
              relative rounded-2xl border-2 p-6 transition-all duration-300
              ${item.color} ${item.hoverColor}
              cursor-pointer group
            `}
          >
            <div className="text-4xl mb-3">{item.icon}</div>
            <h3 className="text-lg font-bold text-zinc-100 mb-1">{item.title}</h3>
            <p className="text-sm text-zinc-400">{item.description}</p>
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </div>
    </div>
  );
}
