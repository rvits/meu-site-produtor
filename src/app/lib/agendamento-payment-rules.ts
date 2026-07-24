import {
  isMultiCouponAgendamentoPackageId,
  isSchedulableServiceType,
} from "@/app/lib/service-catalog";
import { PRODUCTION_DELIVERY_HOUR } from "@/app/lib/calendar-day-state";

type ItemLine = { id?: string; nome?: string; quantidade?: number };

export function isPlanoPaymentDescription(description?: string | null): boolean {
  if (!description) return false;
  return /plano/i.test(description);
}

export function isAgendamentoPaymentDescription(description?: string | null): boolean {
  if (!description) return false;
  return /agendamento/i.test(description);
}

/** Roteamento de tipo para o orquestrador de webhook (sem efeitos colaterais). */
export function resolvePaymentTipo(params: {
  metadata: Record<string, unknown>;
  paymentType?: string | null;
  description?: string | null;
}): string {
  const { metadata, paymentType, description } = params;
  if (metadata.tipo != null && String(metadata.tipo).trim() !== "") {
    return String(metadata.tipo);
  }
  if (paymentType && paymentType !== "outro") return paymentType;
  if (isPlanoPaymentDescription(description)) return "plano";
  if (isAgendamentoPaymentDescription(description)) return "agendamento";
  return "outro";
}

function getActiveAgendamentoLines(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): ItemLine[] {
  const arrS = Array.isArray(services) ? services : [];
  const arrB = Array.isArray(beats) ? beats : [];
  return [...arrS, ...arrB].filter((line) => Math.max(0, Number(line.quantidade) || 0) > 0);
}

export function countAgendamentoItemLines(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): number {
  return getActiveAgendamentoLines(services, beats).reduce(
    (acc, line) => acc + Math.max(1, Number(line.quantidade) || 1),
    0
  );
}

/**
 * Exatamente 1 linha com quantidade 1 (qualquer serviço/pacote do catálogo).
 */
export function isSingleUnitAgendamentoPurchase(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  const active = getActiveAgendamentoLines(services, beats);
  if (active.length !== 1) return false;
  return Math.max(1, Number(active[0].quantidade) || 1) === 1;
}

/**
 * GO-H4: pacote composto unitário → só cupons atômicos (nunca agenda direto).
 */
export function isSingleMultiCouponPackageSelection(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  if (!isSingleUnitAgendamentoPurchase(services, beats)) return false;
  const active = getActiveAgendamentoLines(services, beats)[0];
  return isMultiCouponAgendamentoPackageId(active?.id, active?.nome);
}

/**
 * GO-H4: agenda no checkout só serviço atômico unitário
 * (Sessão, Captação, Beat, Mixagem, Masterização, Sonoplastia…).
 * Pacotes compostos nunca abrem calendário no pagamento.
 */
export function exigeAgendamentoNoCheckout(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  if (!isSingleUnitAgendamentoPurchase(services, beats)) return false;
  if (isSingleMultiCouponPackageSelection(services, beats)) return false;
  return true;
}

/**
 * Horário de estúdio só para Sessão/Captação unitária (presencial).
 */
export function exigeAgendamentoHora(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  if (!exigeAgendamentoNoCheckout(services, beats)) return false;
  const active = getActiveAgendamentoLines(services, beats);
  return isSchedulableServiceType(active[0].id, active[0].nome);
}

/**
 * Produção unitária atômica — só data de entrega desejada (sem horários).
 */
export function exigeAgendamentoSomenteData(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  return (
    exigeAgendamentoNoCheckout(services, beats) &&
    !exigeAgendamentoHora(services, beats)
  );
}

/**
 * Compat: true quando a compra unitária exige data **e** hora (presencial).
 */
export function exigeAgendamentoDataHora(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  return exigeAgendamentoHora(services, beats);
}

/**
 * GO-H4: cupons quando multi-serviço OU pacote composto (mesmo unitário).
 * Serviço atômico unitário nunca emite cupom de agendamento.
 */
export function isCouponsOnlyAgendamentoPayment(
  _metadata: Record<string, unknown>,
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  if (countAgendamentoItemLines(services, beats) > 1) return true;
  return isSingleMultiCouponPackageSelection(services, beats);
}

/**
 * Compra unitária atômica com data no metadata (hora obrigatória só se presencial).
 * Produção pode omitir hora — effects usam PRODUCTION_SCHEDULE_DEFAULT_HOUR.
 */
export function isSingleScheduledAgendamentoPayment(
  metadata: Record<string, unknown>,
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  if (isCouponsOnlyAgendamentoPayment(metadata, services, beats)) return false;
  if (!exigeAgendamentoNoCheckout(services, beats)) return false;
  if (!metadata.data) return false;
  if (exigeAgendamentoHora(services, beats) && !metadata.hora) return false;
  return true;
}

/**
 * Horário padrão para serviços de produção = último horário operacional (prazo de entrega).
 */
export const PRODUCTION_SCHEDULE_DEFAULT_HOUR = PRODUCTION_DELIVERY_HOUR;
