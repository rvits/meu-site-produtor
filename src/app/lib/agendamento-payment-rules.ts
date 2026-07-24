import { isSchedulableServiceType } from "@/app/lib/service-catalog";

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
 * GO-H3: exatamente 1 linha com quantidade 1 (qualquer serviço/pacote do catálogo).
 * Pacotes compostos contam como um único serviço de compra.
 */
export function isSingleUnitAgendamentoPurchase(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  const active = getActiveAgendamentoLines(services, beats);
  if (active.length !== 1) return false;
  return Math.max(1, Number(active[0].quantidade) || 1) === 1;
}

/** @deprecated GO-H3: pacote isolado agenda direto — não gera cupons. Mantido false. */
export function isSingleMultiCouponPackageSelection(
  ..._unused: ItemLine[][]
): boolean {
  void _unused;
  return false;
}

/**
 * GO-H3: compra unitária sempre abre agendamento no checkout (calendário).
 * Multi-serviço → cupons (sem agenda no pagamento).
 */
export function exigeAgendamentoNoCheckout(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  return isSingleUnitAgendamentoPurchase(services, beats);
}

/**
 * GO-H3: horário de estúdio só para Sessão/Captação unitária (presencial).
 */
export function exigeAgendamentoHora(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  if (!isSingleUnitAgendamentoPurchase(services, beats)) return false;
  const active = getActiveAgendamentoLines(services, beats);
  return isSchedulableServiceType(active[0].id, active[0].nome);
}

/**
 * GO-H3: produção unitária — só data de entrega desejada (sem horários).
 */
export function exigeAgendamentoSomenteData(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  return (
    isSingleUnitAgendamentoPurchase(services, beats) &&
    !exigeAgendamentoHora(services, beats)
  );
}

/**
 * Compat: true quando a compra unitária exige data **e** hora (presencial).
 * Produção unitária usa `exigeAgendamentoSomenteData` / `exigeAgendamentoNoCheckout`.
 */
export function exigeAgendamentoDataHora(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  return exigeAgendamentoHora(services, beats);
}

/**
 * GO-H3: cupons de agendamento somente com mais de um serviço (linhas/qty).
 * Compra unitária nunca emite cupom de agendamento.
 */
export function isCouponsOnlyAgendamentoPayment(
  _metadata: Record<string, unknown>,
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  return countAgendamentoItemLines(services, beats) > 1;
}

/**
 * Compra unitária com data no metadata (hora obrigatória só se presencial).
 * Produção pode omitir hora — effects usam 12:00.
 */
export function isSingleScheduledAgendamentoPayment(
  metadata: Record<string, unknown>,
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  if (isCouponsOnlyAgendamentoPayment(metadata, services, beats)) return false;
  if (!isSingleUnitAgendamentoPurchase(services, beats)) return false;
  if (!metadata.data) return false;
  if (exigeAgendamentoHora(services, beats) && !metadata.hora) return false;
  return true;
}

/** Horário padrão para serviços de produção (apenas data de entrega). */
export const PRODUCTION_SCHEDULE_DEFAULT_HOUR = "12:00";
