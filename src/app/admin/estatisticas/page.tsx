"use client";

import { useEffect, useState } from "react";

interface Estatisticas {
  usuarios: {
    total: number;
    comConta: number;
    semConta: number;
    porcentagemComConta: number;
  };
  pagamentos: {
    total: number;
    porUsuarios: number;
    porNaoUsuarios: number;
    valorTotal: number;
  };
  planos: {
    total: number;
    ativos: number;
    inativos: number;
  };
  agendamentos: {
    total: number;
    hoje: number;
    estaSemana: number;
    esteMes: number;
  };
  servicos: {
    total: number;
    pendentes: number;
    aceitos: number;
  };
  usoDiario: {
    data: string;
    usuarios: number;
  }[];
}

export default function AdminEstatisticasPage() {
  const [stats, setStats] = useState<Estatisticas | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  async function carregarEstatisticas() {
    try {
      const res = await fetch("/api/admin/stats/detalhadas");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <p className="text-zinc-400">Carregando estatísticas...</p>;
  }

  if (!stats) {
    return <p className="text-zinc-400">Erro ao carregar estatísticas</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Estatísticas do Site</h1>
        <p className="text-zinc-400">Visão geral completa do uso da plataforma</p>
      </div>

      {/* Usuários */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <h2 className="text-xl font-bold text-zinc-100 mb-4">👥 Usuários</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-400">{stats.usuarios.total}</div>
            <div className="text-sm text-zinc-400 mt-1">Total de Usuários</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-400">{stats.usuarios.comConta}</div>
            <div className="text-sm text-zinc-400 mt-1">Com Conta</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-yellow-400">{stats.usuarios.semConta}</div>
            <div className="text-sm text-zinc-400 mt-1">Sem Conta</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-400">{stats.usuarios.porcentagemComConta.toFixed(1)}%</div>
            <div className="text-sm text-zinc-400 mt-1">% com Conta</div>
          </div>
        </div>
      </div>

      {/* Pagamentos */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <h2 className="text-xl font-bold text-zinc-100 mb-4">💰 Pagamentos</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-400">{stats.pagamentos.total}</div>
            <div className="text-sm text-zinc-400 mt-1">Total de Pagamentos</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-400">{stats.pagamentos.porUsuarios}</div>
            <div className="text-sm text-zinc-400 mt-1">Por Usuários</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-yellow-400">{stats.pagamentos.porNaoUsuarios}</div>
            <div className="text-sm text-zinc-400 mt-1">Por Não Usuários</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-400">R$ {stats.pagamentos.valorTotal.toFixed(2)}</div>
            <div className="text-sm text-zinc-400 mt-1">Valor Total</div>
          </div>
        </div>
      </div>

      {/* Planos */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <h2 className="text-xl font-bold text-zinc-100 mb-4">⭐ Planos</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-400">{stats.planos.total}</div>
            <div className="text-sm text-zinc-400 mt-1">Total de Planos</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-400">{stats.planos.ativos}</div>
            <div className="text-sm text-zinc-400 mt-1">Planos Ativos</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-yellow-400">{stats.planos.inativos}</div>
            <div className="text-sm text-zinc-400 mt-1">Planos Inativos</div>
          </div>
        </div>
      </div>

      {/* Agendamentos */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <h2 className="text-xl font-bold text-zinc-100 mb-4">📅 Agendamentos</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-400">{stats.agendamentos.total}</div>
            <div className="text-sm text-zinc-400 mt-1">Total</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-400">{stats.agendamentos.hoje}</div>
            <div className="text-sm text-zinc-400 mt-1">Hoje</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-400">{stats.agendamentos.estaSemana}</div>
            <div className="text-sm text-zinc-400 mt-1">Esta Semana</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-yellow-400">{stats.agendamentos.esteMes}</div>
            <div className="text-sm text-zinc-400 mt-1">Este Mês</div>
          </div>
        </div>
      </div>

      {/* Serviços */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <h2 className="text-xl font-bold text-zinc-100 mb-4">🎵 Serviços</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-400">{stats.servicos.total}</div>
            <div className="text-sm text-zinc-400 mt-1">Total</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-yellow-400">{stats.servicos.pendentes}</div>
            <div className="text-sm text-zinc-400 mt-1">Pendentes</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-400">{stats.servicos.aceitos}</div>
            <div className="text-sm text-zinc-400 mt-1">Aceitos</div>
          </div>
        </div>
      </div>
    </div>
  );
}
