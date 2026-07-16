import { isMultiCouponAgendamentoPackageId, isSchedulableServiceType } from "@/app/lib/service-catalog";

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

/** Pacote composto sozinho no checkout: libera vários cupons e não usa data/hora no pagamento. */
export function isSingleMultiCouponPackageSelection(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  const active = getActiveAgendamentoLines(services, beats);
  if (active.length !== 1) return false;
  if (Math.max(1, Number(active[0].quantidade) || 1) !== 1) return false;
  if (!active[0].id && !active[0].nome) return false;
  return isMultiCouponAgendamentoPackageId(active[0].id, active[0].nome);
}

/**
 * OP-01: data/hora obrigatória somente para Sessão/Captação isolada.
 * Beat, Mix, Master, Sonoplastia e pacotes → cupons (agenda individual depois).
 */
export function exigeAgendamentoDataHora(
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  if (isSingleMultiCouponPackageSelection(services, beats)) return false;
  const active = getActiveAgendamentoLines(services, beats);
  if (active.length !== 1) return false;
  if (Math.max(1, Number(active[0].quantidade) || 1) !== 1) return false;
  return isSchedulableServiceType(active[0].id, active[0].nome);
}

/** Pagamento que libera cupons por serviço; o agendamento nasce só no resgate do cupom. */
export function isCouponsOnlyAgendamentoPayment(
  _metadata: Record<string, unknown>,
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  const lines = countAgendamentoItemLines(services, beats);
  return lines > 0 && !exigeAgendamentoDataHora(services, beats);
}

/** Um único serviço agendável com data/hora no checkout: cria agendamento direto no pagamento. */
export function isSingleScheduledAgendamentoPayment(
  metadata: Record<string, unknown>,
  services: ItemLine[] = [],
  beats: ItemLine[] = []
): boolean {
  if (isCouponsOnlyAgendamentoPayment(metadata, services, beats)) return false;
  if (countAgendamentoItemLines(services, beats) !== 1) return false;
  return Boolean(metadata.data && metadata.hora);
}
