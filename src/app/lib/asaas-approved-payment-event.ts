/**
 * Reconhecimento operacional de cobrança Asaas (única fonte de verdade).
 *
 * "Pagamento operacionalmente reconhecido" = o provedor já confirmou que o
 * cliente pagou e o domínio PODE criar Payment / Appointment / Service.
 *
 * Isso NÃO é liquidação financeira. PAYMENT_RECEIVED na documentação Asaas
 * significa valor disponível na conta; PAYMENT_CONFIRMED significa pagamento
 * concluído (ex.: cartão/boleto) ainda sem o valor liquidado.
 *
 * Ambos autorizam os mesmos efeitos de domínio. Payment.status "approved"
 * neste projeto continua significando reconhecimento operacional, não
 * "dinheiro já liquidado".
 */

export const OPERATIONAL_ASAAS_APPROVED_EVENTS = [
  "PAYMENT_CONFIRMED",
  "PAYMENT_RECEIVED",
] as const;

export const OPERATIONAL_ASAAS_APPROVED_STATUSES = [
  "CONFIRMED",
  "RECEIVED",
] as const;

const APPROVED_EVENT_SET = new Set<string>(OPERATIONAL_ASAAS_APPROVED_EVENTS);
const APPROVED_STATUS_SET = new Set<string>(OPERATIONAL_ASAAS_APPROVED_STATUSES);

/** Eventos que nunca autorizam efeitos de pagamento aprovado. */
const REJECTED_APPROVAL_EVENTS = new Set<string>([
  "PAYMENT_CREATED",
  "PAYMENT_UPDATED",
  "PAYMENT_OVERDUE",
  "PAYMENT_DELETED",
  "PAYMENT_REFUNDED",
  "PAYMENT_REFUND_IN_PROGRESS",
  "PAYMENT_CHARGEBACK_REQUESTED",
  "PAYMENT_CHARGEBACK_DISPUTE",
  "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
  "PAYMENT_REPROVED_BY_RISK_ANALYSIS",
  "PAYMENT_AWAITING_RISK_ANALYSIS",
  "PAYMENT_APPROVED_BY_RISK_ANALYSIS",
  "PAYMENT_AUTHORIZED",
  "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
  "PAYMENT_DUNNING_RECEIVED",
  "PAYMENT_DUNNING_REQUESTED",
  "PAYMENT_REFUSED",
]);

const REJECTED_APPROVAL_STATUSES = new Set<string>([
  "PENDING",
  "OVERDUE",
  "DELETED",
  "REFUNDED",
  "REFUND_REQUESTED",
  "REFUND_IN_PROGRESS",
  "CHARGEBACK_REQUESTED",
  "CHARGEBACK_DISPUTE",
  "AWAITING_CHARGEBACK_REVERSAL",
  "DUNNING_REQUESTED",
  "DUNNING_RECEIVED",
  "AWAITING_RISK_ANALYSIS",
  "REPROVED",
  "REFUSED",
]);

export type OperationalAsaasWebhookAction = "ignore" | "create" | "reconcile";

export function normalizeAsaasWebhookToken(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

/**
 * True somente quando o par evento+status demonstra pagamento já
 * confirmado/pago para liberar efeitos de domínio.
 *
 * Não discrimina PIX/cartão/boleto — o checkout usa billingType UNDEFINED.
 */
export function isOperationallyApprovedAsaasPaymentEvent(
  event: unknown,
  status: unknown
): boolean {
  const eventNorm = normalizeAsaasWebhookToken(event);
  const statusNorm = normalizeAsaasWebhookToken(status);

  if (!eventNorm || !statusNorm) return false;
  if (REJECTED_APPROVAL_EVENTS.has(eventNorm)) return false;
  if (REJECTED_APPROVAL_STATUSES.has(statusNorm)) return false;
  if (!APPROVED_EVENT_SET.has(eventNorm)) return false;
  if (!APPROVED_STATUS_SET.has(statusNorm)) return false;
  return true;
}

/**
 * Decisão de webhook após o gate: criar Payment ou reconciliar o existente.
 * `existingPaymentId` deve vir do lookup por id Asaas / providerPaymentId.
 */
export function decideOperationalAsaasWebhookAction(params: {
  event: unknown;
  status: unknown;
  existingPaymentId?: string | null;
}): OperationalAsaasWebhookAction {
  if (!isOperationallyApprovedAsaasPaymentEvent(params.event, params.status)) {
    return "ignore";
  }
  if (params.existingPaymentId) return "reconcile";
  return "create";
}

/** Prisma P2002 na corrida CONFIRMED/RECEIVED (Payment.asaasId unique). */
export function isPrismaUniqueConstraintError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "P2002";
}
