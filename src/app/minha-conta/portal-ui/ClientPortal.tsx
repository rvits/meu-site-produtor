"use client";

/**
 * Portal do Cliente (GO-03D) — shell principal de Minha Conta.
 *
 * A lógica de carregamento é idêntica à página original:
 * GET /api/meus-dados + mark-read (FAQ, agendamentos, planos) +
 * useDomainRefresh. Apenas a camada visual foi reconstruída com o
 * Design System. Nenhuma API, regra ou sincronização foi alterada.
 */

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/context/AuthContext";
import { useDomainRefresh } from "@/app/hooks/useDomainRefresh";
import {
  Avatar,
  Button,
  SkeletonCard,
  Skeleton,
  cx,
  Icon,
} from "@/components/design-system";
import type { PortalData } from "./types";
import { TABS, TabKey, isTabKey } from "./tabs";
import { DashboardHome } from "./DashboardHome";
import { AgendaSection } from "./AgendaSection";
import { DownloadsSection, collectDownloads } from "./DownloadsSection";
import { CouponsSection } from "./CouponsSection";
import { PlanSection } from "./PlanSection";
import { HistorySection } from "./HistorySection";
import { NotificationsSection } from "./NotificationsSection";
import { ProfileSection } from "./ProfileSection";
import { HelpSection } from "./HelpSection";

function PortalSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-28" />
        </div>
      </div>
      <Skeleton className="h-10 w-full" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </div>
  );
}

export function ClientPortal() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PortalData>({
    agendamentos: [],
    planos: [],
    cupons: [],
    faqQuestions: [],
    pagamentos: [],
  });

  const tabParam = searchParams.get("tab");
  const tab: TabKey = isTabKey(tabParam) ? tabParam : "visao-geral";
  const aptFocus = searchParams.get("apt");

  const { refresh: refreshConta } = useDomainRefresh(
    ["minha-conta", "cupons", "planos", "pagamentos"],
    async () => {
      if (!user) return;
      await carregarDados();
    }
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    void refreshConta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, refreshConta]);

  async function carregarDados() {
    try {
      // Adicionar timestamp para evitar cache
      const timestamp = new Date().getTime();
      const res = await fetch(`/api/meus-dados?t=${timestamp}`, {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });
      if (res.ok) {
        const payload = await res.json();
        setData({
          agendamentos: payload.agendamentos || [],
          planos: payload.planos || [],
          cupons: payload.cupons || [],
          faqQuestions: payload.faqQuestions || [],
          pagamentos: payload.pagamentos || [],
        });

        // Marcar como lidas (mesma lógica original): FAQ respondidas,
        // agendamentos confirmados e planos ativos não lidos.
        const perguntasRespondidasNaoLidas = (payload.faqQuestions || []).filter(
          (p: any) => p.status === "respondida" && !p.readAt
        );
        const agendamentosConfirmadosNaoLidos = (payload.agendamentos || []).filter((a: any) => {
          const isConfirmed =
            (a.status === "aceito" || a.status === "confirmado") &&
            a.pagamento?.status === "approved";
          return isConfirmed && !a.readAt;
        });
        const planosAtivosNaoLidos = (payload.planos || []).filter((p: any) => {
          const isActive = p.status === "active" && p.ativo === true;
          return isActive && !p.readAt;
        });

        const promises: Promise<any>[] = [];
        if (perguntasRespondidasNaoLidas.length > 0) {
          promises.push(
            ...perguntasRespondidasNaoLidas.map((p: any) =>
              fetch("/api/faq/mark-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ questionId: p.id }),
              }).catch((err) => console.error("Erro ao marcar pergunta como lida:", err))
            )
          );
        }
        if (agendamentosConfirmadosNaoLidos.length > 0) {
          promises.push(
            ...agendamentosConfirmadosNaoLidos.map((a: any) =>
              fetch("/api/appointments/mark-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ appointmentId: a.id }),
              }).catch((err) => console.error("Erro ao marcar agendamento como lido:", err))
            )
          );
        }
        if (planosAtivosNaoLidos.length > 0) {
          promises.push(
            ...planosAtivosNaoLidos.map((p: any) =>
              fetch("/api/plans/mark-read", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ planId: p.id }),
              }).catch((err) => console.error("Erro ao marcar plano como lido:", err))
            )
          );
        }
        if (promises.length > 0) {
          Promise.all(promises).then(() => {
            window.dispatchEvent(new CustomEvent("faq-updated"));
            window.dispatchEvent(new CustomEvent("appointment-updated"));
            window.dispatchEvent(new CustomEvent("plan-updated"));
            setTimeout(() => carregarDados(), 500);
          });
        }
      } else {
        const errorText = await res.text();
        console.error("[Minha Conta] Erro na resposta:", res.status, errorText);
        if (res.status >= 500) {
          setData((prev) => ({ ...prev, cupons: [] }));
        }
      }
    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }

  function goTo(next: TabKey) {
    const params = new URLSearchParams(searchParams.toString());
    if (next === "visao-geral") params.delete("tab");
    else params.set("tab", next);
    params.delete("apt");
    router.replace(`/minha-conta${params.toString() ? `?${params.toString()}` : ""}`, {
      scroll: false,
    });
  }

  const badges = useMemo(() => {
    const downloads = collectDownloads(data.agendamentos).length;
    const cupons = data.cupons.filter((c) => c.status === "disponivel").length;
    const respostas = data.faqQuestions.filter(
      (p) => p.status === "respondida" && !p.readAt
    ).length;
    return { downloads, cupons, respostas } as Record<string, number> & {
      downloads: number;
      cupons: number;
      respostas: number;
    };
  }, [data]);

  if (authLoading || !user || (user && loading)) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-3 sm:p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          <PortalSkeleton />
        </div>
      </div>
    );
  }

  const primeiroNome = user.nomeArtistico?.split(/\s+/)[0] || user.nomeArtistico;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-3 sm:p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
        {/* Cabeçalho de boas-vindas */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar name={user.nomeArtistico} size="lg" className="hidden sm:inline-flex" />
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 truncate">
                Olá, {primeiroNome}
              </h1>
              <p className="text-xs sm:text-sm text-zinc-400">
                Bem-vindo novamente. Este é o seu portal do cliente.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            icon="refresh"
            onClick={() => {
              setLoading(true);
              void carregarDados();
            }}
            title="Atualizar dados"
          >
            Atualizar
          </Button>
        </div>

        {/* Navegação por abas (mobile-first, scroll horizontal) */}
        <nav
          className="flex gap-1 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60 p-1.5 -mx-1 px-1.5 sm:mx-0"
          aria-label="Seções da conta"
        >
          {TABS.map((t) => {
            const active = tab === t.key;
            const badge =
              t.key === "downloads"
                ? badges.downloads
                : t.key === "cupons"
                ? badges.cupons
                : t.key === "ajuda" || t.key === "notificacoes"
                ? badges.respostas
                : 0;
            return (
              <button
                key={t.key}
                onClick={() => goTo(t.key)}
                className={cx(
                  "relative flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-2 text-xs sm:text-sm font-semibold transition-colors flex-shrink-0",
                  active
                    ? "bg-red-600 text-white shadow-sm shadow-red-900/40"
                    : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                )}
              >
                <Icon name={t.icon} className="w-3.5 h-3.5" />
                {t.label}
                {badge > 0 && (
                  <span
                    className={cx(
                      "ml-0.5 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full px-1 text-[10px] font-bold",
                      active ? "bg-white/20 text-white" : "bg-red-600 text-white"
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Conteúdo da aba */}
        <div className="animate-[fadeIn_.2s_ease]">
          {tab === "visao-geral" && (
            <DashboardHome nome={primeiroNome} data={data} goTo={goTo} />
          )}
          {tab === "agendamentos" && (
            <AgendaSection
              agendamentos={data.agendamentos}
              onChanged={carregarDados}
              focusId={aptFocus ? Number(aptFocus) : null}
            />
          )}
          {tab === "downloads" && <DownloadsSection agendamentos={data.agendamentos} />}
          {tab === "cupons" && (
            <CouponsSection
              cupons={data.cupons}
              onChanged={carregarDados}
            />
          )}
          {tab === "plano" && (
            <PlanSection planos={data.planos} cupons={data.cupons} onChanged={carregarDados} />
          )}
          {tab === "historico" && <HistorySection data={data} />}
          {tab === "notificacoes" && <NotificationsSection data={data} />}
          {tab === "perfil" && <ProfileSection />}
          {tab === "ajuda" && <HelpSection faqQuestions={data.faqQuestions} />}
        </div>
      </div>
    </div>
  );
}
