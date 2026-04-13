"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Stats = {
  appointments: number;
  appointmentsPendente: number;
  appointmentsAceitos: number;
  appointmentsCancelados: number;
  appointmentsRecusados: number;
  appointmentsEmAndamento: number;
  appointmentsConcluidos: number;
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
    title: "Serviços Selecionados",
    description: "Por agendamento: a fazer e feitos (registrar como feito)",
    icon: "📋",
    href: "/admin/servicos-solicitados",
    color: "from-pink-500/20 to-pink-600/20 border-pink-500/30",
    hoverColor: "hover:from-pink-500/30 hover:to-pink-600/30",
  },
  {
    id: "servicos-aceitos",
    title: "Serviços Gerais",
    description: "Solicitados, aceitos e negados (vinculados ao agendamento)",
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
  const [reprocessando, setReprocessando] = useState(false);

  async function reprocessarPagamentoTeste() {
    setReprocessando(true);
    try {
      const res = await fetch("/api/admin/reprocessar-pagamento-teste", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const who = data.forUser ? ` (usuário: ${data.forUser.email || data.forUser.nome || "—"})` : "";
        alert(`Reprocessado: ${data.servicesCreated} serviço(s) e ${data.couponsCreated} cupom(ns) criados${who}. ${data.hint || "Atualize Minha Conta e as páginas de Agendamentos/Serviços no admin."}`);
      } else {
        alert(data.error || "Erro ao reprocessar. Faça um pagamento de teste primeiro.");
      }
    } catch {
      alert("Erro ao reprocessar pagamento de teste.");
    } finally {
      setReprocessando(false);
    }
  }

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/stats", { credentials: "include" });
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

      {/* Ação rápida: Reprocessar pagamento de teste */}
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-zinc-100">Pagamento de teste (R$ 5)</h3>
          <p className="text-sm text-zinc-400 mt-1">Se agendamento/serviços/cupons não aparecerem, reprocesse o último pagamento de teste.</p>
        </div>
        <button
          type="button"
          onClick={reprocessarPagamentoTeste}
          disabled={reprocessando}
          className="rounded-lg border border-amber-500/50 bg-amber-600/30 px-4 py-2 text-sm font-medium text-amber-100 hover:bg-amber-600/50 disabled:opacity-50"
        >
          {reprocessando ? "Reprocessando..." : "Reprocessar último pagamento de teste"}
        </button>
      </div>

      {/* Agendamentos por status (substitui o card único) + demais métricas */}
      {!loading && stats && (
        <div className="space-y-6">
          <div>
            <p className="text-sm font-medium text-zinc-400 mb-3">Agendamentos por status</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 min-w-0">
              <Link
                href="/admin/agendamentos?status=pendente"
                className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 transition hover:border-orange-500/40 hover:bg-zinc-800 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-orange-500" />
                  <span className="text-zinc-300 text-sm truncate">Pendentes</span>
                </div>
                <div className="text-2xl font-bold text-orange-400 mt-2 tabular-nums">{stats.appointmentsPendente}</div>
              </Link>
              <Link
                href="/admin/agendamentos?status=aceitos"
                className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 transition hover:border-green-500/40 hover:bg-zinc-800 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-green-500" />
                  <span className="text-zinc-300 text-sm truncate">Aceitos</span>
                </div>
                <div className="text-2xl font-bold text-green-400 mt-2 tabular-nums">{stats.appointmentsAceitos}</div>
              </Link>
              <Link
                href="/admin/agendamentos?status=cancelado"
                className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 transition hover:border-red-500/40 hover:bg-zinc-800 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-red-500" />
                  <span className="text-zinc-300 text-sm truncate">Cancelados</span>
                </div>
                <div className="text-2xl font-bold text-red-400 mt-2 tabular-nums">{stats.appointmentsCancelados}</div>
              </Link>
              <Link
                href="/admin/agendamentos?status=recusado"
                className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 transition hover:border-zinc-500/50 hover:bg-zinc-800 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-zinc-500" />
                  <span className="text-zinc-300 text-sm truncate">Recusados</span>
                </div>
                <div className="text-2xl font-bold text-zinc-400 mt-2 tabular-nums">{stats.appointmentsRecusados}</div>
              </Link>
              <Link
                href="/admin/agendamentos?filtro=em_andamento"
                className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 transition hover:border-blue-500/40 hover:bg-zinc-800 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-blue-500" />
                  <span className="text-zinc-300 text-sm truncate">Em andamento</span>
                </div>
                <div className="text-2xl font-bold text-blue-400 mt-2 tabular-nums">{stats.appointmentsEmAndamento}</div>
              </Link>
              <Link
                href="/admin/agendamentos?filtro=concluidos"
                className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-4 transition hover:border-purple-500/40 hover:bg-zinc-800 min-w-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-3 w-3 shrink-0 rounded-full bg-purple-500" />
                  <span className="text-zinc-300 text-sm truncate">Concluídos</span>
                </div>
                <div className="text-2xl font-bold text-purple-400 mt-2 tabular-nums">{stats.appointmentsConcluidos}</div>
              </Link>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Total no sistema: <span className="text-zinc-400 tabular-nums">{stats.appointments}</span>
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-zinc-400 mb-3">Outras métricas</p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
          </div>
        </div>
      )}

      {/* Menu Items */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold text-zinc-200 text-center mb-6">Módulos de Gerenciamento</h2>
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
          {MENU_ITEMS.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`
                relative rounded-xl md:rounded-2xl border-2 p-3 md:p-6 transition-all duration-300
                ${item.color} ${item.hoverColor}
                cursor-pointer group
              `}
            >
              <div className="text-2xl md:text-4xl mb-2 md:mb-3">{item.icon}</div>
              <h3 className="text-sm md:text-lg font-bold text-zinc-100 mb-1">{item.title}</h3>
              <p className="text-xs md:text-sm text-zinc-400 hidden md:block">{item.description}</p>
              <div className="absolute inset-0 rounded-xl md:rounded-2xl bg-gradient-to-br from-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
