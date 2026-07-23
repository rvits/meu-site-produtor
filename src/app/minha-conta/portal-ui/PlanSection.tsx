"use client";

/**
 * Portal do Cliente — Área de Plano.
 * Mesmas ações e mensagens da página original: cancelar plano,
 * solicitar reembolso, excluir da lista.
 */

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Icon,
  Section,
  StatusBadge,
  formatBRL,
  formatDate,
  useFeedback,
} from "@/components/design-system";
import type { Cupom, Plano } from "./types";
import {
  cancelarPlano,
  excluirPlano,
  solicitarReembolsoPlano,
} from "./actions";
import { isPlanFamilyCoupon } from "./helpers";

export function PlanSection({
  planos,
  cupons,
  onChanged,
}: {
  planos: Plano[];
  cupons: Cupom[];
  onChanged: () => Promise<void> | void;
}) {
  const { notifySuccess, notifyError, ask } = useFeedback();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleCancelar(plano: Plano) {
    if (
      !(await ask(
        "Cancelar plano",
        "Tem certeza que deseja cancelar este plano? Os cupons vinculados a este plano deixarão de ser visíveis e utilizáveis na sua conta."
      ))
    ) {
      return;
    }
    setBusyId(plano.id);
    try {
      const { ok, data } = await cancelarPlano(plano.id);
      if (ok) {
        notifySuccess("Plano cancelado", "Seu plano foi cancelado com sucesso.");
        await onChanged();
      } else {
        notifyError("Erro ao cancelar plano", data.error || undefined);
      }
    } catch {
      notifyError("Erro ao cancelar plano");
    } finally {
      setBusyId(null);
    }
  }

  async function handleReembolso(plano: Plano) {
    if (
      !(await ask(
        "Solicitar reembolso do plano",
        "O valor será proporcional aos cupons que ainda não foram utilizados (cupons já usados não são reembolsáveis). O valor será creditado em até 5 dias úteis na conta vinculada ao pagamento."
      ))
    )
      return;
    setBusyId(plano.id);
    try {
      const { ok, data } = await solicitarReembolsoPlano(plano.id);
      if (ok) {
        notifySuccess(
          "Reembolso solicitado com sucesso!",
          `Valor: R$ ${(data.refundAmount ?? 0)
            .toFixed(2)
            .replace(".", ",")}. O valor será creditado em até 5 dias úteis.`
        );
        await onChanged();
      } else {
        notifyError("Erro ao solicitar reembolso", data.error || undefined);
      }
    } catch (e) {
      console.error(e);
      notifyError("Erro ao solicitar reembolso");
    } finally {
      setBusyId(null);
    }
  }

  async function handleExcluir(plano: Plano) {
    if (
      !(await ask(
        "Excluir plano",
        "Excluir este plano inativo da sua lista? Os cupons vinculados a ele também serão removidos.",
        true
      ))
    )
      return;
    setBusyId(plano.id);
    try {
      const { ok, data } = await excluirPlano(plano.id);
      if (ok) {
        await onChanged();
        window.dispatchEvent(new CustomEvent("appointment-updated"));
      } else {
        notifyError("Erro ao excluir plano", data.error || undefined);
      }
    } catch (e) {
      console.error(e);
      notifyError("Erro ao excluir plano");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Section title="Plano" icon="box">
      {planos.length === 0 ? (
        <EmptyState
          icon="box"
          title="Você não possui planos"
          description="Assine um plano na página Planos ou faça um pagamento teste."
          action={
            <a
              href="/planos"
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors"
            >
              <Icon name="sparkles" className="w-4 h-4" />
              Conhecer os planos
            </a>
          }
        />
      ) : (
        <div className="space-y-3">
          {planos.map((plano) => {
            const cuponsDoPlano = cupons.filter(
              (c) => c.userPlanId === plano.id && isPlanFamilyCoupon(c)
            );
            const disponiveis = cuponsDoPlano.filter((c) => c.status === "disponivel").length;
            return (
              <Card
                key={plano.id}
                className={plano.ativo ? "!border-emerald-500/40 !bg-emerald-500/5" : undefined}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-zinc-100">{plano.planName}</h3>
                      <Badge intent={plano.ativo ? "success" : "error"} dot>
                        {plano.ativo ? "Ativo" : "Inativo"}
                      </Badge>
                      <StatusBadge status={plano.status} />
                    </div>
                    <p className="text-sm text-zinc-400">
                      {plano.modo === "mensal" ? "Mensal" : "Anual"} · {formatBRL(plano.amount)}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                      <span>Início: {formatDate(plano.startDate)}</span>
                      {plano.expiraEm && <span>Expira em: {formatDate(plano.expiraEm)}</span>}
                    </div>
                    {cuponsDoPlano.length > 0 && (
                      <p className="text-xs text-zinc-400 flex items-center gap-1.5 pt-1">
                        <Icon name="ticket" className="w-3.5 h-3.5 text-emerald-400" />
                        Créditos do plano: <strong className="text-emerald-300">{disponiveis}</strong>{" "}
                        de {cuponsDoPlano.length} cupons disponíveis
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
                    {plano.ativo ? (
                      <Button
                        variant="danger"
                        disabled={busyId === plano.id}
                        onClick={() => handleCancelar(plano)}
                      >
                        Cancelar plano
                      </Button>
                    ) : (
                      <>
                        {!plano.refundProcessedAt && plano.podeSolicitarReembolso !== false ? (
                          <Button
                            variant="secondary"
                            icon="wallet"
                            disabled={busyId === plano.id}
                            onClick={() => handleReembolso(plano)}
                            className="!bg-sky-600 hover:!bg-sky-500 !text-white !border-transparent"
                          >
                            Solicitar reembolso do plano
                          </Button>
                        ) : !plano.refundProcessedAt && plano.podeSolicitarReembolso === false ? (
                          <span className="text-xs text-zinc-500 max-w-52">
                            Reembolso automático não disponível para este plano (ex.: plano de
                            teste).
                          </span>
                        ) : null}
                        {plano.refundProcessedAt && (
                          <span className="text-xs text-sky-300 max-w-60">
                            Reembolso solicitado em {formatDate(plano.refundProcessedAt)}. Valor
                            será creditado em até 5 dias úteis.
                          </span>
                        )}
                        <Button
                          variant="outline"
                          disabled={busyId === plano.id}
                          onClick={() => handleExcluir(plano)}
                          title="Remover da lista para poder testar novamente"
                        >
                          Excluir da lista
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
          <div className="flex justify-end">
            <a
              href="/planos"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-400 hover:text-red-300"
            >
              Gerenciar plano
              <Icon name="arrow-right" className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      )}
    </Section>
  );
}
