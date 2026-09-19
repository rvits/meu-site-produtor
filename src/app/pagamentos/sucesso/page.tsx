"use client";

/**
 * Pagamento aprovado — GO-03E/F Design System.
 * GO-04A.2 RC-09: timeout, retry controlado, botão Atualizar status.
 * Sem redirect automático para Minha Conta.
 */

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useDomainSync } from "@/app/lib/synchronization/DomainSyncProvider";
import {
  Button,
  Callout,
  Card,
  LinkButton,
  LoadingBlock,
  StatusPage,
  Spinner,
} from "@/components/design-system";

const POLL_INTERVAL_MS = 5000;
const TIMEOUT_MS = 90_000;
const MAX_AUTO_RETRIES = 18;

/** Aba real do portal: visão geral lista agendamentos e cupons/direitos. */
export const MINHA_CONTA_POS_PAGAMENTO_HREF = "/minha-conta?tab=visao-geral";

function SucessoContent() {
  const searchParams = useSearchParams();
  const isTeste = searchParams.get("teste") === "true";
  const tipo = searchParams.get("tipo");
  const operationId = searchParams.get("operationId");
  const { connected, lastEvent } = useDomainSync();
  const [confirmado, setConfirmado] = useState(() => !operationId);
  const [timedOut, setTimedOut] = useState(false);
  const [checking, setChecking] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [statusHint, setStatusHint] = useState(
    "O pagamento foi iniciado. Estamos verificando automaticamente a confirmação."
  );
  const startedAt = useRef(Date.now());
  const autoRetries = useRef(0);

  const markConfirmed = useCallback(() => {
    setConfirmado(true);
    setTimedOut(false);
  }, []);

  const pollStatus = useCallback(async () => {
    if (!operationId || confirmado) return false;
    setChecking(true);
    try {
      const res = await fetch(
        `/api/pagamentos/verificar?operationId=${encodeURIComponent(operationId)}`
      );
      if (!res.ok) {
        setStatusHint(
          "Ainda não conseguimos confirmar. Continuamos verificando automaticamente."
        );
        return false;
      }
      const data = await res.json();
      if (data.processed && data.effectsReady) {
        markConfirmed();
        return true;
      }
      setStatusHint(
        "Pagamento ainda está sendo confirmado. Estamos verificando automaticamente."
      );
      return false;
    } catch {
      setStatusHint(
        'Não foi possível atualizar agora. Tente novamente em instantes com "Atualizar status".'
      );
      return false;
    } finally {
      setChecking(false);
    }
  }, [operationId, confirmado, markConfirmed]);

  useEffect(() => {
    if (
      lastEvent?.name !== "PaymentConfirmed" ||
      lastEvent.metadata?.effectsReady !== true ||
      !operationId ||
      lastEvent.metadata?.operationId !== operationId
    ) {
      return;
    }
    markConfirmed();
  }, [lastEvent, operationId, markConfirmed]);

  useEffect(() => {
    if (confirmado || !operationId) return;

    const tick = async () => {
      const elapsed = Date.now() - startedAt.current;
      if (elapsed >= TIMEOUT_MS || autoRetries.current >= MAX_AUTO_RETRIES) {
        setTimedOut(true);
        setStatusHint(
          'A confirmação está demorando mais que o usual. Use "Atualizar status" ou acesse Minha Conta — o pagamento pode já ter sido processado.'
        );
        return;
      }
      autoRetries.current += 1;
      setRetryCount(autoRetries.current);
      await pollStatus();
    };

    void tick();
    const interval = setInterval(() => {
      void tick();
    }, POLL_INTERVAL_MS);

    const timeout = setTimeout(() => {
      setTimedOut(true);
      setStatusHint(
        'Caso demore mais que alguns minutos, utilize "Atualizar status". Você também pode acompanhar em Minha Conta.'
      );
    }, TIMEOUT_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [confirmado, operationId, pollStatus]);

  if (!confirmado) {
    return (
      <StatusPage
        intent={timedOut ? "warning" : "info"}
        icon={timedOut ? "clock" : "refresh"}
        title={timedOut ? "Confirmação em andamento" : "Aguardando confirmação"}
        description={statusHint}
        actions={
          <>
            <Button
              variant="primary"
              size="md"
              loading={checking}
              onClick={() => {
                void pollStatus();
              }}
            >
              Atualizar status
            </Button>
            <LinkButton href={MINHA_CONTA_POS_PAGAMENTO_HREF} variant="outline" size="md">
              Ir para Minha Conta
            </LinkButton>
          </>
        }
      >
        <div className="flex flex-col items-center gap-3">
          {!timedOut && <Spinner className="w-6 h-6" aria-hidden />}
          <p className="text-xs text-zinc-500 text-center">
            Sincronização {connected ? "conectada" : "reconectando…"}
            {operationId ? ` · verificação automática (${retryCount})` : ""}
          </p>
          <Callout intent="info" title="O que fazer">
            Pagamento ainda está sendo confirmado. Estamos verificando automaticamente. Caso
            demore mais que alguns minutos, utilize &quot;Atualizar status&quot;.
          </Callout>
        </div>
      </StatusPage>
    );
  }

  const effectsVerified = Boolean(operationId);
  const isPlano = tipo === "plano";

  const body = isPlano ? (
    <>
      <p className="text-sm font-semibold text-emerald-300 mb-1">Pagamento confirmado!</p>
      <p className="text-sm text-zinc-400 leading-relaxed">
        {effectsVerified
          ? "Seu pagamento foi processado com sucesso. O plano e os serviços do seu ciclo estão disponíveis na Minha Conta."
          : "Seu pagamento foi processado. Você pode consultar o plano e os serviços na Minha Conta."}
        {!isTeste && " Você receberá um e-mail de confirmação em breve."}
      </p>
      <p className="text-sm text-zinc-400 leading-relaxed mt-3">
        Serviços que ainda não têm data e horário podem ser agendados por lá.
      </p>
    </>
  ) : (
    <>
      <p className="text-sm font-semibold text-emerald-300 mb-1">Pagamento confirmado!</p>
      <p className="text-sm text-zinc-400 leading-relaxed">
        {effectsVerified
          ? "Seu pagamento foi processado com sucesso. Seus serviços adquiridos estão disponíveis na sua conta."
          : "Seu pagamento foi processado. Você pode consultar o status e seus serviços na Minha Conta."}
        {!isTeste && " Você receberá um e-mail de confirmação em breve."}
      </p>
      <p className="text-sm text-zinc-400 leading-relaxed mt-3">
        Serviços que ainda não possuem data e horário podem ser agendados nessa área. Se já
        houver um horário definido, o agendamento também aparece na Minha Conta.
      </p>
    </>
  );

  return (
    <StatusPage
      intent="success"
      icon="check-circle"
      title="Pagamento confirmado!"
      description="Seu pagamento foi processado com sucesso."
      actions={
        <>
          <LinkButton href={MINHA_CONTA_POS_PAGAMENTO_HREF} variant="primary" size="md">
            Ver meus serviços e agendar
          </LinkButton>
          <LinkButton href="/" variant="outline" size="md">
            Voltar para o início
          </LinkButton>
        </>
      }
    >
      {isTeste && (
        <Callout intent="warning" title="Pagamento de teste">
          Este foi um pagamento de teste (R$ 5,00).
        </Callout>
      )}
      <Card className="!border-emerald-500/30 !bg-emerald-500/5">{body}</Card>
      {!effectsVerified && (
        <Callout intent="info" title="Acompanhe na sua conta">
          Você pode consultar o status e seus serviços na Minha Conta assim que a confirmação
          for concluída.
        </Callout>
      )}
    </StatusPage>
  );
}

export default function Sucesso() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center">
          <LoadingBlock label="Carregando…" />
        </div>
      }
    >
      <SucessoContent />
    </Suspense>
  );
}
