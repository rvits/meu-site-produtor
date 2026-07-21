"use client";

/**
 * Portal do Cliente — Área de Cupons.
 * Mesma classificação, textos de política e ações da página original
 * (copiar, agendar com cupom, renunciar, vincular cupons teste).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Callout,
  Card,
  EmptyState,
  Section,
  Tag,
  cx,
  formatBRL,
  formatDate,
  useFeedback,
  useToast,
} from "@/components/design-system";
import type { Cupom } from "./types";
import {
  copyToClipboard,
  couponScheduleHref,
  getServiceName,
  isPlanFamilyCoupon,
  isRefundFamilyCoupon,
  isServiceFamilyCoupon,
} from "./helpers";
import { renunciarCupom, vincularCuponsTeste } from "./actions";

function CouponCode({ code, tone }: { code: string; tone: string }) {
  const toast = useToast();
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <p className={cx("text-xl font-bold font-mono tracking-wider break-all", tone)}>{code}</p>
      <Button
        variant="ghost"
        size="xs"
        icon="copy"
        onClick={async () => {
          await copyToClipboard(code);
          toast.success("Código copiado", "O cupom foi copiado para a área de transferência.");
        }}
      >
        Copiar
      </Button>
    </div>
  );
}

export function CouponsSection({
  cupons,
  showTestCouponTools,
  onChanged,
}: {
  cupons: Cupom[];
  showTestCouponTools: boolean;
  onChanged: () => Promise<void> | void;
}) {
  const router = useRouter();
  const { notifySuccess, notifyError, notify, ask } = useFeedback();
  const [vinculando, setVinculando] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const planoDisp = cupons.filter((c) => c.status === "disponivel" && isPlanFamilyCoupon(c));
  const servicoDisp = cupons.filter((c) => c.status === "disponivel" && isServiceFamilyCoupon(c));
  const reembolsoDisp = cupons.filter((c) => c.status === "disponivel" && isRefundFamilyCoupon(c));
  const usados = cupons.filter((c) => c.status === "usado");
  const expirados = cupons.filter((c) => c.status === "expirado");

  async function handleRenunciar(cupom: Cupom) {
    if (
      !(await ask(
        "Excluir cupom",
        "Excluir este cupom da sua lista? Você não poderá usá-lo depois.",
        true
      ))
    )
      return;
    setBusyId(cupom.id);
    try {
      const { ok, data } = await renunciarCupom(cupom.id);
      if (ok) {
        await onChanged();
      } else {
        notifyError("Erro ao excluir cupom", data.error || undefined);
      }
    } catch (e) {
      console.error(e);
      notifyError("Erro ao excluir cupom");
    } finally {
      setBusyId(null);
    }
  }

  async function handleVincularTeste() {
    setVinculando(true);
    try {
      const { data } = await vincularCuponsTeste();
      if (data.success) {
        await new Promise((r) => setTimeout(r, 400));
        await onChanged();
        setVinculando(false);
        const qtd = (data.cuponsCount ?? 0) as number;
        if (qtd > 0) {
          notifySuccess(
            data.message ?? "Cupons vinculados.",
            'Se não aparecerem acima, clique em "Atualizar" no topo da página.'
          );
        } else {
          notify(
            data.message ??
              "Vinculado. Se os cupons não aparecerem, clique em Atualizar ou recarregue a página (F5)."
          );
        }
        return;
      }
      notifyError(
        "Não foi possível vincular",
        data.error || "Faça um pagamento de teste primeiro."
      );
    } catch {
      notifyError("Erro ao vincular cupons de teste");
    } finally {
      setVinculando(false);
    }
  }

  return (
    <Section title="Cupons" icon="ticket">
      <Callout intent="info" title="Como funcionam os cupons">
        <p className="mb-1">
          <strong className="text-emerald-300">Cupons de Plano:</strong> gerados quando você assina
          um plano. Permitem usar serviços específicos <strong>gratuitamente</strong> (zeram o valor
          total). Cada serviço deve ser agendado separadamente.
        </p>
        <p>
          <strong className="text-sky-300">Cupons de Reembolso:</strong> gerados quando um
          agendamento é cancelado ou recusado. Servem como <strong>crédito</strong> para descontar
          do valor total. Podem zerar o serviço ou ser usados como desconto parcial (você paga a
          diferença). <strong className="text-amber-300">Importante:</strong> sobras não utilizadas{" "}
          <strong>se perdem</strong> — não acumulam crédito.
        </p>
      </Callout>

      {cupons.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            icon="ticket"
            title="Você não possui cupons"
            description="Se o admin associou cupons ao seu e-mail, clique em Atualizar no topo da página ou recarregue (F5)."
          />
          {showTestCouponTools && (
            <Callout intent="warning" title="Ferramentas de teste">
              <p className="mb-2">
                Pagou R$ 5 de teste (agendamento) e os cupons não aparecem aqui?
              </p>
              <Button
                variant="secondary"
                disabled={vinculando}
                loading={vinculando}
                onClick={handleVincularTeste}
                className="!bg-amber-600 hover:!bg-amber-500 !text-white !border-transparent"
              >
                {vinculando ? "Vinculando..." : "Vincular cupons de teste à minha conta"}
              </Button>
            </Callout>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {planoDisp.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-emerald-400">
                Cupons de Plano — disponíveis ({planoDisp.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {planoDisp.map((cupom) => (
                  <Card key={cupom.id} className="!border-emerald-500/40 !bg-emerald-500/5 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                      Código do cupom
                    </p>
                    <CouponCode code={cupom.code} tone="text-emerald-300" />
                    {cupom.serviceType && (
                      <p className="text-sm text-zinc-300">
                        <strong>Serviço:</strong> {getServiceName(cupom.serviceType, cupons, cupom.code)}
                      </p>
                    )}
                    {cupom.expiresAt && (
                      <p className="text-xs text-zinc-400">Válido até: {formatDate(cupom.expiresAt)}</p>
                    )}
                    {cupom.userPlan?.endDate && (
                      <p className="text-xs text-amber-300">
                        Válido até 1 mês após expiração do plano ({formatDate(cupom.userPlan.endDate)})
                      </p>
                    )}
                    <p className="text-xs text-emerald-400">
                      Este cupom zera o valor do serviço específico. Agende quando quiser!
                    </p>
                    <Button
                      variant="success"
                      fullWidth
                      icon="calendar"
                      onClick={() => router.push(couponScheduleHref(cupom))}
                    >
                      Usar agora
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      fullWidth
                      disabled={busyId === cupom.id}
                      onClick={() => handleRenunciar(cupom)}
                    >
                      Excluir da minha lista
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {servicoDisp.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-cyan-400">
                Cupons de Serviço — disponíveis ({servicoDisp.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {servicoDisp.map((cupom) => (
                  <Card key={cupom.id} className="!border-cyan-500/40 !bg-cyan-500/5 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-400">
                      Código do cupom
                    </p>
                    <CouponCode code={cupom.code} tone="text-cyan-300" />
                    {cupom.serviceType && (
                      <p className="text-sm text-zinc-300">
                        <strong>Serviço:</strong> {getServiceName(cupom.serviceType, cupons, cupom.code)}
                      </p>
                    )}
                    {cupom.expiresAt && (
                      <p className="text-xs text-zinc-400">Válido até: {formatDate(cupom.expiresAt)}</p>
                    )}
                    <p className="text-xs text-cyan-400">
                      Cupom de serviço avulso — use para agendar o serviço indicado.
                    </p>
                    <Button
                      variant="secondary"
                      fullWidth
                      icon="calendar"
                      onClick={() => router.push(couponScheduleHref(cupom))}
                      className="!bg-cyan-600 hover:!bg-cyan-500 !text-white !border-transparent"
                    >
                      Usar agora
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {reembolsoDisp.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-sky-400">
                Cupons de Reembolso — disponíveis ({reembolsoDisp.length})
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {reembolsoDisp.map((cupom) => (
                  <Card key={cupom.id} className="!border-sky-500/40 !bg-sky-500/5 space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-400">
                      Código do cupom
                    </p>
                    <CouponCode code={cupom.code} tone="text-sky-300" />
                    <p className="text-sm text-zinc-300">
                      <strong>Valor:</strong> {formatBRL(cupom.discountValue)}
                    </p>
                    {cupom.expiresAt && (
                      <p className="text-xs text-zinc-400">Válido até: {formatDate(cupom.expiresAt)}</p>
                    )}
                    <p className="text-xs text-amber-300">
                      Pode zerar o serviço ou ser usado como desconto parcial.{" "}
                      <strong>Sobras não utilizadas se perdem.</strong>
                    </p>
                    <Button
                      variant="secondary"
                      fullWidth
                      icon="calendar"
                      onClick={() => router.push(couponScheduleHref(cupom))}
                      className="!bg-sky-600 hover:!bg-sky-500 !text-white !border-transparent"
                    >
                      Usar agora
                    </Button>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {usados.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-zinc-400">Usados ({usados.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {usados.map((cupom) => (
                  <Card key={cupom.id} className="opacity-60 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <CouponCode code={cupom.code} tone="text-zinc-500 !text-base" />
                      <Badge intent="neutral">Usado</Badge>
                    </div>
                    {cupom.serviceType && (
                      <p className="text-sm text-zinc-500">
                        <strong>Serviço:</strong> {getServiceName(cupom.serviceType, cupons, cupom.code)}
                      </p>
                    )}
                    {cupom.usedAt && (
                      <p className="text-xs text-zinc-600">Usado em: {formatDate(cupom.usedAt)}</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {expirados.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-red-400">Expirados ({expirados.length})</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {expirados.map((cupom) => (
                  <Card key={cupom.id} className="!border-red-500/30 !bg-red-500/5 opacity-60 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-bold text-red-400 font-mono tracking-wider line-through break-all">
                        {cupom.code}
                      </p>
                      <Tag intent={isPlanFamilyCoupon(cupom) ? "success" : "info"}>
                        {isPlanFamilyCoupon(cupom) ? "Plano" : "Reembolso"}
                      </Tag>
                    </div>
                    {cupom.serviceType && (
                      <p className="text-sm text-zinc-500">
                        <strong>Serviço:</strong> {getServiceName(cupom.serviceType, cupons, cupom.code)}
                      </p>
                    )}
                    {cupom.discountValue > 0 && cupom.discountType === "fixed" && (
                      <p className="text-sm text-zinc-500">
                        <strong>Valor:</strong> {formatBRL(cupom.discountValue)}
                      </p>
                    )}
                    {cupom.expiresAt && (
                      <p className="text-xs text-red-400">Expirou em: {formatDate(cupom.expiresAt)}</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
