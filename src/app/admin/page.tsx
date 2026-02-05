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
  pendingFaqs: number;
};

const MENU_ITEMS = [
  // Linha 1
  {
    id: "usuarios",
    title: "Usuários",
    description: "Informações completas dos usuários",
    icon: "👥",
    href: "/admin/usuarios",
    color: "from-purple-500/20 to-purple-600/20 border-purple-500/30",
    hoverColor: "hover:from-purple-500/30 hover:to-purple-600/30",
  },
  {
    id: "agendamentos",
    title: "Agendamentos",
    description: "Solicitações pendentes, aceitas e recusadas",
    icon: "📅",
    href: "/admin/agendamentos",
    color: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
    hoverColor: "hover:from-blue-500/30 hover:to-blue-600/30",
  },
  {
    id: "controle-agendamento",
    title: "Controle de Agendamento",
    description: "Gerenciar calendário e horários",
    icon: "🗓️",
    href: "/admin/controle-agendamento",
    color: "from-cyan-500/20 to-cyan-600/20 border-cyan-500/30",
    hoverColor: "hover:from-cyan-500/30 hover:to-cyan-600/30",
  },
  {
    id: "planos",
    title: "Planos e Cupons",
    description: "Assinaturas e serviços dos planos",
    icon: "⭐",
    href: "/admin/planos",
    color: "from-yellow-500/20 to-yellow-600/20 border-yellow-500/30",
    hoverColor: "hover:from-yellow-500/30 hover:to-yellow-600/30",
  },
  // Linha 2
  {
    id: "faq",
    title: "FAQ",
    description: "Gerenciar perguntas e comentários",
    icon: "❓",
    href: "/admin/faq",
    color: "from-teal-500/20 to-teal-600/20 border-teal-500/30",
    hoverColor: "hover:from-teal-500/30 hover:to-teal-600/30",
  },
  {
    id: "servicos-solicitados",
    title: "Serviços Solicitados",
    description: "Solicitações pendentes e recusadas",
    icon: "📋",
    href: "/admin/servicos-solicitados",
    color: "from-pink-500/20 to-pink-600/20 border-pink-500/30",
    hoverColor: "hover:from-pink-500/30 hover:to-pink-600/30",
  },
  {
    id: "servicos-aceitos",
    title: "Serviços Aceitos",
    description: "Serviços em andamento e concluídos",
    icon: "✅",
    href: "/admin/servicos-aceitos",
    color: "from-green-500/20 to-green-600/20 border-green-500/30",
    hoverColor: "hover:from-green-500/30 hover:to-green-600/30",
  },
  {
    id: "pagamentos",
    title: "Pagamentos",
    description: "Transações e reembolsos",
    icon: "💰",
    href: "/admin/pagamentos",
    color: "from-emerald-500/20 to-emerald-600/20 border-emerald-500/30",
    hoverColor: "hover:from-emerald-500/30 hover:to-emerald-600/30",
  },
  // Linha 3
  {
    id: "estatisticas",
    title: "Estatísticas",
    description: "Estatísticas detalhadas do site",
    icon: "📊",
    href: "/admin/estatisticas",
    color: "from-indigo-500/20 to-indigo-600/20 border-indigo-500/30",
    hoverColor: "hover:from-indigo-500/30 hover:to-indigo-600/30",
  },
  {
    id: "chats-pendentes",
    title: "Chats Pendentes",
    description: "Solicitações de atendimento humano",
    icon: "⏳",
    href: "/admin/chats-pendentes",
    color: "from-orange-500/20 to-orange-600/20 border-orange-500/30",
    hoverColor: "hover:from-orange-500/30 hover:to-orange-600/30",
  },
  {
    id: "chats-gerais",
    title: "Chats Gerais",
    description: "Todas as conversas e chats respondidos",
    icon: "💬",
    href: "/admin/chats-gerais",
    color: "from-blue-500/20 to-blue-600/20 border-blue-500/30",
    hoverColor: "hover:from-blue-500/30 hover:to-blue-600/30",
  },
  {
    id: "manutencao",
    title: "Pausa Virtual",
    description: "Ativar modo de manutenção",
    icon: "⏸️",
    href: "/admin/manutencao",
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
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
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
          <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4">
            <div className="text-2xl font-bold text-red-400">{stats.pendingFaqs}</div>
            <div className="text-xs text-zinc-400 mt-1">FAQs Pendentes</div>
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-zinc-200 text-center mb-6">Módulos de Gerenciamento</h2>
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
    </div>
  );
}
