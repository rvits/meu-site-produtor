"use client";

/**
 * Portal do Cliente — Visão geral (dashboard do cliente).
 * Cards-resumo calculados exclusivamente a partir do payload de
 * /api/meus-dados, todos clicáveis para a aba correspondente.
 */

import { useMemo } from "react";
import {
  Card,
  Grid,
  Icon,
  IconName,
  Section,
  StatusBadge,
  Timeline,
  cx,
  formatDate,
  formatTime,
} from "@/components/design-system";
import type { PortalData } from "./types";
import type { TabKey } from "./tabs";
import { collectDownloads } from "./DownloadsSection";
import { buildNotifications } from "./NotificationsSection";

const STATUS_ATIVOS = new Set(["pendente", "aceito", "confirmado", "em_andamento"]);

function SummaryCard({
  icon,
  label,
  value,
  hint,
  tone = "text-zinc-100",
  onClick,
}: {
  icon: IconName;
  label: string;
  value: string | number;
  hint?: string;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className="text-left rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-all hover:border-zinc-600 hover:bg-zinc-800/60 hover:-translate-y-0.5 group"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="flex w-8 h-8 items-center justify-center rounded-lg bg-zinc-800 text-zinc-400 group-hover:text-red-400 transition-colors">
          <Icon name={icon} className="w-4 h-4" />
        </span>
        <Icon
          name="chevron-right"
          className="w-3.5 h-3.5 text-zinc-700 group-hover:text-zinc-400 transition-colors"
        />
      </div>
      <p className={cx("text-2xl font-bold leading-tight", tone)}>{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
    </button>
  );
}

export function DashboardHome({
  data,
  goTo,
}: {
  nome: string;
  data: PortalData;
  goTo: (tab: TabKey) => void;
}) {
  const agora = Date.now();

  const resumo = useMemo(() => {
    const servicosAtivos = data.agendamentos.filter((a) => STATUS_ATIVOS.has(a.status)).length;
    const proximos = data.agendamentos.filter(
      (a) => STATUS_ATIVOS.has(a.status) && new Date(a.data).getTime() >= agora
    );
    const downloads = collectDownloads(data.agendamentos).length;
    const cuponsDisponiveis = data.cupons.filter((c) => c.status === "disponivel").length;
    const planoAtual = data.planos.find((p) => p.ativo) ?? null;
    const pagamentosPendentes = (data.pagamentos ?? []).filter(
      (p) => p.status === "pending"
    ).length;
    return { servicosAtivos, proximos, downloads, cuponsDisponiveis, planoAtual, pagamentosPendentes };
  }, [data, agora]);

  const atividade = useMemo(() => buildNotifications(data).slice(0, 6), [data]);
  const proximosTres = resumo.proximos
    .slice()
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime())
    .slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Cards-resumo */}
      <Grid cols={3} className="lg:grid-cols-3 xl:grid-cols-6">
        <SummaryCard
          icon="music"
          label="Serviços ativos"
          value={resumo.servicosAtivos}
          hint="Agendamentos pendentes, aceitos ou em andamento"
          onClick={() => goTo("agendamentos")}
        />
        <SummaryCard
          icon="calendar"
          label="Próximos agendamentos"
          value={resumo.proximos.length}
          hint="Agendamentos futuros confirmados ou pendentes"
          onClick={() => goTo("agendamentos")}
        />
        <SummaryCard
          icon="download"
          label="Downloads disponíveis"
          value={resumo.downloads}
          hint="Arquivos entregues pelo estúdio"
          tone={resumo.downloads > 0 ? "text-emerald-300" : "text-zinc-100"}
          onClick={() => goTo("downloads")}
        />
        <SummaryCard
          icon="ticket"
          label="Cupons disponíveis"
          value={resumo.cuponsDisponiveis}
          hint="Cupons de plano, serviço e reembolso prontos para usar"
          tone={resumo.cuponsDisponiveis > 0 ? "text-amber-300" : "text-zinc-100"}
          onClick={() => goTo("cupons")}
        />
        <SummaryCard
          icon="box"
          label="Plano atual"
          value={resumo.planoAtual ? resumo.planoAtual.planName : "—"}
          hint={resumo.planoAtual ? "Plano ativo" : "Nenhum plano ativo"}
          tone={resumo.planoAtual ? "text-emerald-300" : "text-zinc-500"}
          onClick={() => goTo("plano")}
        />
        <SummaryCard
          icon="credit-card"
          label="Pagamentos pendentes"
          value={resumo.pagamentosPendentes}
          hint="Pagamentos aguardando confirmação"
          tone={resumo.pagamentosPendentes > 0 ? "text-orange-300" : "text-zinc-100"}
          onClick={() => goTo("historico")}
        />
      </Grid>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Próximos agendamentos */}
        <Section
          title="Próximos agendamentos"
          icon="calendar"
          actions={
            <button
              onClick={() => goTo("agendamentos")}
              className="text-xs font-semibold text-red-400 hover:text-red-300 inline-flex items-center gap-1"
            >
              Ver todos
              <Icon name="arrow-right" className="w-3 h-3" />
            </button>
          }
        >
          {proximosTres.length === 0 ? (
            <Card className="text-sm text-zinc-500 flex items-center gap-2">
              <Icon name="calendar" className="w-4 h-4 text-zinc-600" />
              Nenhum agendamento futuro. Que tal agendar uma sessão?
            </Card>
          ) : (
            <div className="space-y-2">
              {proximosTres.map((a) => (
                <Card key={a.id} className="flex items-center gap-3">
                  <span className="flex flex-col items-center justify-center w-12 rounded-lg bg-zinc-800 border border-zinc-700 py-1">
                    <span className="text-[10px] uppercase text-zinc-500 leading-none">
                      {new Date(a.data).toLocaleDateString("pt-BR", { month: "short" })}
                    </span>
                    <span className="text-base font-bold text-zinc-100 leading-tight">
                      {new Date(a.data).getDate()}
                    </span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-zinc-100 truncate">{a.tipo}</p>
                    <p className="text-[11px] text-zinc-500">
                      {formatDate(a.data)} às {formatTime(a.data)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </Card>
              ))}
            </div>
          )}
        </Section>

        {/* Última atividade */}
        <Section
          title="Última atividade"
          icon="bell"
          actions={
            <button
              onClick={() => goTo("notificacoes")}
              className="text-xs font-semibold text-red-400 hover:text-red-300 inline-flex items-center gap-1"
            >
              Ver tudo
              <Icon name="arrow-right" className="w-3 h-3" />
            </button>
          }
        >
          {atividade.length === 0 ? (
            <Card className="text-sm text-zinc-500 flex items-center gap-2">
              <Icon name="bell" className="w-4 h-4 text-zinc-600" />
              Nenhuma atividade recente.
            </Card>
          ) : (
            <Card>
              <Timeline items={atividade} compact />
            </Card>
          )}
        </Section>
      </div>
    </div>
  );
}
