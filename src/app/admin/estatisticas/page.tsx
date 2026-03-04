"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

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
    totalAtivos: number;
    totalCancelados: number;
    hoje: number;
    hojeCancelados: number;
    estaSemana: number;
    estaSemanaCancelados: number;
    esteMes: number;
    esteMesCancelados: number;
  };
  servicos: {
    total: number;
    pendentes: number;
    aceitos: number;
    aFazer?: number;
    concluidos?: number;
    cancelados?: number;
  };
  usoDiario: {
    data: string;
    usuarios: number;
  }[];
}

type Periodo = "diario" | "semanal" | "mensal" | "anual";

function formatMesAtual() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function formatDataHoje() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AdminEstatisticasPage() {
  const [stats, setStats] = useState<Estatisticas | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [graficoUsuarios, setGraficoUsuarios] = useState(false);
  const [graficoPagamentos, setGraficoPagamentos] = useState(false);
  const [graficoPlanos, setGraficoPlanos] = useState(false);
  const [graficoAgendamentos, setGraficoAgendamentos] = useState(false);
  const [graficoServicos, setGraficoServicos] = useState(false);

  const [periodoUsuarios, setPeriodoUsuarios] = useState<Periodo>("mensal");
  const [periodoPagamentos, setPeriodoPagamentos] = useState("mensal");
  const [mesPagamentos, setMesPagamentos] = useState(formatMesAtual());
  const [filtroPagamentos, setFiltroPagamentos] = useState("todos");
  const [filtrosPagamentosLista, setFiltrosPagamentosLista] = useState<{ id: string; label: string }[]>([{ id: "todos", label: "Todos" }]);
  const [periodoPlanos, setPeriodoPlanos] = useState("mensal");
  const [mesPlanos, setMesPlanos] = useState(formatMesAtual());
  const [periodoAgendamentos, setPeriodoAgendamentos] = useState<Periodo>("mensal");
  const [dataUsuarios, setDataUsuarios] = useState(formatDataHoje());
  const [mesUsuarios, setMesUsuarios] = useState(formatMesAtual());
  const [anoUsuarios, setAnoUsuarios] = useState(String(new Date().getFullYear()));
  const [dataAgendamentos, setDataAgendamentos] = useState(formatDataHoje());
  const [mesAgendamentos, setMesAgendamentos] = useState(formatMesAtual());
  const [periodoServicos, setPeriodoServicos] = useState<Periodo>("mensal");
  const [dataServicos, setDataServicos] = useState(formatDataHoje());
  const [mesServicos, setMesServicos] = useState(formatMesAtual());

  const [dadosGrafico, setDadosGrafico] = useState<unknown>(null);
  const [loadingGrafico, setLoadingGrafico] = useState(false);
  const [qualGrafico, setQualGrafico] = useState<string | null>(null);

  useEffect(() => {
    carregarEstatisticas();
  }, []);

  // Atualizar estatísticas periodicamente e ao voltar para a aba (integração com o resto do site)
  useEffect(() => {
    const interval = setInterval(carregarEstatisticas, 45 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible") carregarEstatisticas();
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  useEffect(() => {
    if (graficoPagamentos && filtrosPagamentosLista.length <= 1) {
      fetch("/api/admin/stats/graficos?secao=filtros-pagamentos", { credentials: "include" })
        .then((r) => r.json())
        .then((data) => data.filtros?.length && setFiltrosPagamentosLista(data.filtros))
        .catch(() => {});
    }
  }, [graficoPagamentos, filtrosPagamentosLista.length]);

  async function carregarEstatisticas() {
    try {
      setErro(null);
      const res = await fetch("/api/admin/stats/detalhadas", { credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStats(data);
      } else {
        setStats(null);
        setErro(data.error || `Erro ${res.status} ao carregar estatísticas`);
      }
    } catch (err) {
      console.error("Erro ao carregar estatísticas", err);
      setStats(null);
      setErro("Falha ao conectar. Verifique se está logado como admin.");
    } finally {
      setLoading(false);
    }
  }

  const buscarGrafico = useCallback(
    async (secao: string, periodo?: string, mes?: string, data?: string, ano?: string, filtro?: string) => {
      setQualGrafico(secao);
      setLoadingGrafico(true);
      setDadosGrafico(null);
      try {
        const params = new URLSearchParams({ secao });
        if (periodo) params.set("periodo", periodo);
        if (mes) params.set("mes", mes);
        if (data) params.set("data", data);
        if (ano) params.set("ano", ano);
        if (filtro) params.set("filtro", filtro);
        const res = await fetch(`/api/admin/stats/graficos?${params}`, { credentials: "include" });
        const json = await res.json().catch(() => ({}));
        if (res.ok) setDadosGrafico(json);
        else setDadosGrafico({ error: json.error || "Erro ao carregar" });
      } catch {
        setDadosGrafico({ error: "Falha ao carregar dados" });
      } finally {
        setLoadingGrafico(false);
      }
    },
    []
  );

  if (loading) {
    return <p className="text-zinc-400">Carregando estatísticas...</p>;
  }

  if (erro || !stats) {
    return (
      <div className="rounded-xl border border-red-500/50 bg-red-500/10 p-6 text-center text-red-300 max-w-md mx-auto">
        <p className="font-semibold mb-2">Erro ao carregar estatísticas</p>
        <p className="text-sm mb-4">{erro || "Dados não disponíveis."}</p>
        <button
          type="button"
          onClick={() => {
            setErro(null);
            setLoading(true);
            carregarEstatisticas();
          }}
          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const servicosComFallback = {
    ...stats.servicos,
    aFazer: stats.servicos.aFazer ?? stats.servicos.aceitos,
    concluidos: stats.servicos.concluidos ?? 0,
    cancelados: stats.servicos.cancelados ?? 0,
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-zinc-100 mb-2">Estatísticas do Site</h1>
        <p className="text-zinc-400">Visão geral completa do uso da plataforma</p>
      </div>

      {/* Usuários */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-zinc-100">👥 Usuários</h2>
          <button
            type="button"
            onClick={() => setGraficoUsuarios((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm"
          >
            {graficoUsuarios ? "Ocultar gráfico" : "Ver gráfico"}
          </button>
        </div>
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
        {graficoUsuarios && (
          <div className="mt-6 pt-6 border-t border-zinc-700">
            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={periodoUsuarios}
                onChange={(e) => setPeriodoUsuarios(e.target.value as Periodo)}
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
              >
                <option value="diario">Diário (por hora)</option>
                <option value="semanal">Semanal (por dia)</option>
                <option value="mensal">Mensal (por dia)</option>
                <option value="anual">Anual (por mês)</option>
              </select>
              {periodoUsuarios === "diario" && (
                <input
                  type="date"
                  value={dataUsuarios}
                  onChange={(e) => setDataUsuarios(e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
                />
              )}
              {periodoUsuarios === "mensal" && (
                <input
                  type="month"
                  value={mesUsuarios}
                  onChange={(e) => setMesUsuarios(e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
                />
              )}
              {periodoUsuarios === "anual" && (
                <input
                  type="number"
                  min={2020}
                  max={2030}
                  value={anoUsuarios}
                  onChange={(e) => setAnoUsuarios(e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm w-20"
                />
              )}
              <button
                type="button"
                onClick={() =>
                  buscarGrafico(
                    "usuarios",
                    periodoUsuarios,
                    periodoUsuarios === "mensal" ? mesUsuarios : undefined,
                    periodoUsuarios === "diario" ? dataUsuarios : undefined,
                    periodoUsuarios === "anual" ? anoUsuarios : undefined
                  )
                }
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white"
              >
                Atualizar
              </button>
            </div>
            {qualGrafico === "usuarios" && (
              <>
                {loadingGrafico && <p className="text-zinc-400 text-sm">Carregando...</p>}
                {!loadingGrafico && dadosGrafico && "error" in (dadosGrafico as { error?: string }) && (
                  <p className="text-red-400 text-sm">{(dadosGrafico as { error: string }).error}</p>
                )}
                {!loadingGrafico && dadosGrafico && "buckets" in (dadosGrafico as { buckets?: unknown[] }) && (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(dadosGrafico as { buckets: { label: string; valor: number }[] }).buckets}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#52525b" />
                        <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
                        <YAxis stroke="#a1a1aa" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: "#27272a", border: "1px solid #52525b" }} />
                        <Bar dataKey="valor" fill="#22c55e" name="Novos usuários" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Pagamentos */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-zinc-100">💰 Pagamentos</h2>
          <button
            type="button"
            onClick={() => setGraficoPagamentos((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm"
          >
            {graficoPagamentos ? "Ocultar gráfico" : "Ver gráfico"}
          </button>
        </div>
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
        {graficoPagamentos && (
          <div className="mt-6 pt-6 border-t border-zinc-700">
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <span className="text-zinc-400 text-sm">Mês:</span>
              <input
                type="month"
                value={mesPagamentos}
                onChange={(e) => setMesPagamentos(e.target.value)}
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
              />
              <span className="text-zinc-400 text-sm">Filtro:</span>
              <select
                value={filtroPagamentos}
                onChange={(e) => setFiltroPagamentos(e.target.value)}
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
              >
                {filtrosPagamentosLista.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => buscarGrafico("pagamentos", "mensal", mesPagamentos, undefined, undefined, filtroPagamentos)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white"
              >
                Atualizar
              </button>
            </div>
            {qualGrafico === "pagamentos" && (
              <>
                {loadingGrafico && <p className="text-zinc-400 text-sm">Carregando...</p>}
                {!loadingGrafico && dadosGrafico && "error" in (dadosGrafico as { error?: string }) && (
                  <p className="text-red-400 text-sm">{(dadosGrafico as { error: string }).error}</p>
                )}
                {!loadingGrafico && dadosGrafico && "buckets" in (dadosGrafico as { buckets?: unknown[] }) && (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(dadosGrafico as { buckets: { label: string; valor: number; valorTotal: number }[] }).buckets}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#52525b" />
                        <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
                        <YAxis stroke="#a1a1aa" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: "#27272a", border: "1px solid #52525b" }} />
                        <Legend />
                        <Bar dataKey="valor" fill="#22c55e" name="Quantidade" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="valorTotal" fill="#3b82f6" name="Valor (R$)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Planos */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-zinc-100">⭐ Planos</h2>
          <button
            type="button"
            onClick={() => setGraficoPlanos((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm"
          >
            {graficoPlanos ? "Ocultar gráfico" : "Ver gráfico"}
          </button>
        </div>
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
        {graficoPlanos && (
          <div className="mt-6 pt-6 border-t border-zinc-700">
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-zinc-400 text-sm">Mês:</span>
              <input
                type="month"
                value={mesPlanos}
                onChange={(e) => setMesPlanos(e.target.value)}
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
              />
              <button
                type="button"
                onClick={() => buscarGrafico("planos", "mensal", mesPlanos)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white"
              >
                Atualizar
              </button>
            </div>
            {qualGrafico === "planos" && (
              <>
                {loadingGrafico && <p className="text-zinc-400 text-sm">Carregando...</p>}
                {!loadingGrafico && dadosGrafico && "error" in (dadosGrafico as { error?: string }) && (
                  <p className="text-red-400 text-sm">{(dadosGrafico as { error: string }).error}</p>
                )}
                {!loadingGrafico && dadosGrafico && "buckets" in (dadosGrafico as { buckets?: unknown[] }) && (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(dadosGrafico as { buckets: { label: string; assinados: number; cancelados: number }[] }).buckets}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#52525b" />
                        <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
                        <YAxis stroke="#a1a1aa" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: "#27272a", border: "1px solid #52525b" }} />
                        <Legend />
                        <Bar dataKey="assinados" fill="#22c55e" name="Assinados" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="cancelados" fill="#ef4444" name="Cancelados / não renovados" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Agendamentos */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-zinc-100">📅 Agendamentos</h2>
          <button
            type="button"
            onClick={() => setGraficoAgendamentos((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm"
          >
            {graficoAgendamentos ? "Ocultar gráfico" : "Ver gráfico"}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-400">{stats.agendamentos.total}</div>
            <div className="text-sm text-zinc-400 mt-1">Total</div>
            <div className="text-xs text-zinc-500 mt-2 flex gap-2">
              <span className="text-green-400">{stats.agendamentos.totalAtivos} ativos</span>
              <span className="text-orange-400">{stats.agendamentos.totalCancelados} cancelados</span>
            </div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400">{stats.agendamentos.hoje}</div>
            <div className="text-xs text-orange-400 font-medium">{stats.agendamentos.hojeCancelados} cancelados</div>
            <div className="text-sm text-zinc-400 mt-1">Hoje</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.agendamentos.estaSemana}</div>
            <div className="text-xs text-orange-400 font-medium">{stats.agendamentos.estaSemanaCancelados} cancelados</div>
            <div className="text-sm text-zinc-400 mt-1">Esta Semana</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-yellow-400">{stats.agendamentos.esteMes}</div>
            <div className="text-xs text-orange-400 font-medium">{stats.agendamentos.esteMesCancelados} cancelados</div>
            <div className="text-sm text-zinc-400 mt-1">Este Mês</div>
          </div>
        </div>
        {graficoAgendamentos && (
          <div className="mt-6 pt-6 border-t border-zinc-700">
            <div className="flex flex-wrap gap-2 mb-4">
              <select
                value={periodoAgendamentos}
                onChange={(e) => setPeriodoAgendamentos(e.target.value as Periodo)}
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
              >
                <option value="diario">Diário (por hora)</option>
                <option value="semanal">Semanal (por dia)</option>
                <option value="mensal">Mensal (por dia)</option>
              </select>
              {periodoAgendamentos === "diario" && (
                <input
                  type="date"
                  value={dataAgendamentos}
                  onChange={(e) => setDataAgendamentos(e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
                />
              )}
              {periodoAgendamentos === "mensal" && (
                <input
                  type="month"
                  value={mesAgendamentos}
                  onChange={(e) => setMesAgendamentos(e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
                />
              )}
              <button
                type="button"
                onClick={() => {
                  if (periodoAgendamentos === "diario") {
                    buscarGrafico("agendamentos", "diario", undefined, dataAgendamentos);
                  } else if (periodoAgendamentos === "semanal") {
                    buscarGrafico("agendamentos", "semanal");
                  } else {
                    buscarGrafico("agendamentos", "mensal", mesAgendamentos);
                  }
                }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white"
              >
                Atualizar
              </button>
              <button
                type="button"
                onClick={() => {
                  if (periodoAgendamentos === "diario") {
                    buscarGrafico("agendamentos-servicos", "diario", undefined, dataAgendamentos);
                  } else if (periodoAgendamentos === "semanal") {
                    buscarGrafico("agendamentos-servicos", "semanal");
                  } else {
                    buscarGrafico("agendamentos-servicos", "mensal", mesAgendamentos);
                  }
                }}
                className="px-3 py-1 bg-violet-600 hover:bg-violet-500 rounded text-sm text-white"
              >
                Por tipo de serviço
              </button>
            </div>
            {(qualGrafico === "agendamentos" || qualGrafico === "agendamentos-servicos") && (
              <>
                {loadingGrafico && <p className="text-zinc-400 text-sm">Carregando...</p>}
                {!loadingGrafico && dadosGrafico && "error" in (dadosGrafico as { error?: string }) && (
                  <p className="text-red-400 text-sm">{(dadosGrafico as { error: string }).error}</p>
                )}
                {!loadingGrafico && qualGrafico === "agendamentos" && dadosGrafico && "buckets" in (dadosGrafico as { buckets?: unknown[] }) && (
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={(dadosGrafico as { buckets: { label: string; valor: number }[] }).buckets}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#52525b" />
                        <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
                        <YAxis stroke="#a1a1aa" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: "#27272a", border: "1px solid #52525b" }} />
                        <Bar dataKey="valor" fill="#8b5cf6" name="Agendamentos" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {!loadingGrafico && qualGrafico === "agendamentos-servicos" && dadosGrafico && "series" in (dadosGrafico as { series?: { tipo: string; pontos: { label: string; valor: number }[] }[] }) && (() => {
                  const { series } = dadosGrafico as { series: { tipo: string; pontos: { label: string; valor: number }[] }[] };
                  const labels = Array.from(new Set(series.flatMap((s) => s.pontos.map((p) => p.label)))).sort();
                  const cores = ["#8b5cf6", "#22c55e", "#3b82f6", "#eab308", "#ef4444", "#ec4899"];
                  const data = labels.map((label) => {
                    const row: Record<string, string | number> = { label };
                    series.forEach((s) => {
                      const p = s.pontos.find((x) => x.label === label);
                      row[s.tipo] = p ? p.valor : 0;
                    });
                    return row;
                  });
                  return (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#52525b" />
                          <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
                          <YAxis stroke="#a1a1aa" fontSize={12} />
                          <Tooltip contentStyle={{ backgroundColor: "#27272a", border: "1px solid #52525b" }} />
                          <Legend />
                          {series.map((s, i) => (
                            <Bar key={s.tipo} dataKey={s.tipo} fill={cores[i % cores.length]} name={s.tipo} stackId="a" radius={[0, 0, 0, 0]} />
                          ))}
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Serviços - estatísticas + gráfico e análise por tipo */}
      <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-xl font-bold text-zinc-100">🎵 Serviços</h2>
          <button
            type="button"
            onClick={() => setGraficoServicos((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm"
          >
            {graficoServicos ? "Ocultar análises" : "Ver gráfico e por tipo"}
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-red-400">{servicosComFallback.total}</div>
            <div className="text-sm text-zinc-400 mt-1">Total</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-yellow-400">{servicosComFallback.pendentes}</div>
            <div className="text-sm text-zinc-400 mt-1">Pendentes</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-green-400">{servicosComFallback.aceitos}</div>
            <div className="text-sm text-zinc-400 mt-1">Aceitos</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-blue-400">{servicosComFallback.aFazer}</div>
            <div className="text-sm text-zinc-400 mt-1">A fazer</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-emerald-400">{servicosComFallback.concluidos}</div>
            <div className="text-sm text-zinc-400 mt-1">Concluídos</div>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4">
            <div className="text-3xl font-bold text-orange-400">{servicosComFallback.cancelados}</div>
            <div className="text-sm text-zinc-400 mt-1">Cancelados</div>
          </div>
        </div>
        {graficoServicos && (
          <div className="mt-6 pt-6 border-t border-zinc-700">
            <div className="flex flex-wrap gap-2 mb-4 items-center">
              <select
                value={periodoServicos}
                onChange={(e) => setPeriodoServicos(e.target.value as Periodo)}
                className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
              >
                <option value="diario">Diário (por hora)</option>
                <option value="semanal">Semanal (por dia)</option>
                <option value="mensal">Mensal (por dia)</option>
              </select>
              {periodoServicos === "diario" && (
                <input
                  type="date"
                  value={dataServicos}
                  onChange={(e) => setDataServicos(e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
                />
              )}
              {periodoServicos === "mensal" && (
                <input
                  type="month"
                  value={mesServicos}
                  onChange={(e) => setMesServicos(e.target.value)}
                  className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-zinc-200 text-sm"
                />
              )}
              <button
                type="button"
                onClick={() =>
                  buscarGrafico(
                    "servicos",
                    periodoServicos,
                    periodoServicos === "mensal" ? mesServicos : undefined,
                    periodoServicos === "diario" ? dataServicos : undefined
                  )
                }
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm text-white"
              >
                Gráfico por período
              </button>
              <button
                type="button"
                onClick={() =>
                  buscarGrafico(
                    "servicos-tipos",
                    periodoServicos,
                    periodoServicos === "mensal" ? mesServicos : undefined,
                    periodoServicos === "diario" ? dataServicos : undefined
                  )
                }
                className="px-3 py-1 bg-violet-600 hover:bg-violet-500 rounded text-sm text-white"
              >
                Por tipo de serviço
              </button>
            </div>
            {(qualGrafico === "servicos" || qualGrafico === "servicos-tipos") && (
              <>
                {loadingGrafico && <p className="text-zinc-400 text-sm">Carregando...</p>}
                {!loadingGrafico && dadosGrafico && "error" in (dadosGrafico as { error?: string }) && (
                  <p className="text-red-400 text-sm">{(dadosGrafico as { error: string }).error}</p>
                )}
                {!loadingGrafico && qualGrafico === "servicos" && dadosGrafico && "buckets" in (dadosGrafico as { buckets?: unknown[] }) && (
                  <div className="h-72 w-full mb-6">
                    <p className="text-zinc-400 text-sm mb-2">Serviços solicitados por período (por status)</p>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={(dadosGrafico as { buckets: { label: string; pendentes: number; aceitos: number; concluidos: number; cancelados: number; recusados: number }[] }).buckets}
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#52525b" />
                        <XAxis dataKey="label" stroke="#a1a1aa" fontSize={12} />
                        <YAxis stroke="#a1a1aa" fontSize={12} />
                        <Tooltip contentStyle={{ backgroundColor: "#27272a", border: "1px solid #52525b" }} />
                        <Legend />
                        <Bar dataKey="pendentes" stackId="a" fill="#eab308" name="Pendentes" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="aceitos" stackId="a" fill="#22c55e" name="Aceitos" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="concluidos" stackId="a" fill="#10b981" name="Concluídos" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="cancelados" stackId="a" fill="#f97316" name="Cancelados" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="recusados" stackId="a" fill="#ef4444" name="Recusados" radius={[0, 0, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {!loadingGrafico && qualGrafico === "servicos-tipos" && dadosGrafico && "tipos" in (dadosGrafico as { tipos?: unknown[] }) && (() => {
                  const { tipos } = dadosGrafico as { tipos: { tipo: string; total: number; pendentes: number; aceitos: number; concluidos: number; cancelados: number; recusados: number; primeiraData: string | null; ultimaData: string | null }[] };
                  const formatDt = (s: string | null) => (s ? new Date(s).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "—");
                  return (
                    <div className="overflow-x-auto">
                      <p className="text-zinc-400 text-sm mb-2">Serviços por tipo (quantidade e datas no período)</p>
                      <table className="w-full text-sm text-left text-zinc-300 border border-zinc-600 rounded-lg overflow-hidden">
                        <thead className="bg-zinc-700/80 text-zinc-200">
                          <tr>
                            <th className="px-3 py-2">Tipo</th>
                            <th className="px-3 py-2">Total</th>
                            <th className="px-3 py-2">Pendentes</th>
                            <th className="px-3 py-2">Aceitos</th>
                            <th className="px-3 py-2">Concluídos</th>
                            <th className="px-3 py-2">Cancelados</th>
                            <th className="px-3 py-2">Recusados</th>
                            <th className="px-3 py-2">Primeira data</th>
                            <th className="px-3 py-2">Última data</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tipos.length === 0 ? (
                            <tr><td colSpan={9} className="px-3 py-4 text-zinc-500">Nenhum serviço no período.</td></tr>
                          ) : (
                            tipos.map((row) => (
                              <tr key={row.tipo} className="border-t border-zinc-600 hover:bg-zinc-700/30">
                                <td className="px-3 py-2 font-medium">{row.tipo}</td>
                                <td className="px-3 py-2">{row.total}</td>
                                <td className="px-3 py-2">{row.pendentes}</td>
                                <td className="px-3 py-2">{row.aceitos}</td>
                                <td className="px-3 py-2">{row.concluidos}</td>
                                <td className="px-3 py-2">{row.cancelados}</td>
                                <td className="px-3 py-2">{row.recusados}</td>
                                <td className="px-3 py-2">{formatDt(row.primeiraData)}</td>
                                <td className="px-3 py-2">{formatDt(row.ultimaData)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
