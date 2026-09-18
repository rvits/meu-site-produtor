/**
 * Planejamento e validação de recovery de cobrança Asaas já confirmada.
 * Writes de domínio só via processPaymentWebhook quando execute=true.
 */
import {
  decideOperationalAsaasWebhookAction,
  isOperationallyApprovedAsaasPaymentEvent,
} from "@/app/lib/asaas-approved-payment-event";
import { expectedServiceLines } from "@/app/lib/asaas-agendamento-payment-effects";
import { expandPurchaseToServiceOrders } from "@/app/lib/service-orders";

export const RECOVERY_CONFIRMED_EVENT = "PAYMENT_CONFIRMED" as const;
export const RECOVERY_CONFIRMED_STATUS = "CONFIRMED" as const;

export type CarrinhoRecoveryItem = {
  data?: string;
  hora?: string;
  duracaoMinutos?: number;
  tipo?: string;
  observacoes?: string;
  servicos?: Array<{ id?: string; nome?: string; quantidade?: number; preco?: number }>;
  beats?: Array<{ id?: string; nome?: string; quantidade?: number; preco?: number }>;
  cupomCode?: string;
  couponId?: string;
  subtotal?: number;
  total?: number;
  discount?: number;
};

export type RecoveryAbortCode =
  | "METADATA_MISSING"
  | "ASAAS_ID_MISMATCH"
  | "AMOUNT_MISMATCH"
  | "UNEXPECTED_TIPO"
  | "NO_SCHEDULED_CART_ITEM"
  | "EMPTY_CART_RIGHTS"
  | "EVENT_NOT_APPROVED"
  | "REFUND_OR_CHARGEBACK"
  | "OPERATION_ID_REQUIRED"
  | "ASAAS_ID_REQUIRED";

export type RecoveryPlan = {
  ok: boolean;
  abortCode?: RecoveryAbortCode;
  abortMessage?: string;
  action?: "create" | "reconcile" | "ignore";
  event: typeof RECOVERY_CONFIRMED_EVENT;
  status: typeof RECOVERY_CONFIRMED_STATUS;
  tipo?: string;
  expectedAmount?: number;
  appointmentCount: number;
  serviceCount: number;
  serviceTipos: string[];
  appointmentTipo?: string;
  hasSchedule: boolean;
  couponOps: number;
  serviceOrderOps: number;
  materialization?: "appointment-services" | "pending-rights" | "mixed";
  expectedPaymentFields: {
    asaasIdFrom: "asaas-payment-id";
    amountFrom: "asaas-value-cross-checked-with-metadata";
    status: "approved";
    typeInitial: "agendamento";
    provider: "ASAAS";
    paymentMethodOnCreate: null;
  };
};

function parseItems(metadata: Record<string, unknown>): CarrinhoRecoveryItem[] {
  try {
    const raw = metadata.items;
    if (typeof raw === "string") {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    }
    if (Array.isArray(raw)) return raw as CarrinhoRecoveryItem[];
  } catch {
    return [];
  }
  return [];
}

export function metadataAmount(metadata: Record<string, unknown>): number {
  const raw = metadata.chargedAmount ?? metadata.amount ?? metadata.total;
  return Number(raw);
}

export function parseCarrinhoMetadataItems(metadata: Record<string, unknown>): CarrinhoRecoveryItem[] {
  return parseItems(metadata);
}

export function scheduledCarrinhoItems(items: CarrinhoRecoveryItem[]): CarrinhoRecoveryItem[] {
  return items.filter((item) => Boolean(String(item.data || "").trim() && String(item.hora || "").trim()));
}

/** Metadata para log/dry-run: IDs comerciais e agenda, sem PII. */
export function sanitizeCarrinhoMetadataForLog(
  metadata: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!metadata) return null;
  const items = parseItems(metadata).map((item) => ({
    tipo: item.tipo ?? null,
    data: String(item.data || "").trim() || null,
    hora: String(item.hora || "").trim() || null,
    duracaoMinutos: item.duracaoMinutos ?? null,
    servicos: (Array.isArray(item.servicos) ? item.servicos : []).map((s) => ({
      id: s.id ?? null,
      quantidade: s.quantidade ?? null,
    })),
    beats: (Array.isArray(item.beats) ? item.beats : []).map((b) => ({
      id: b.id ?? null,
      quantidade: b.quantidade ?? null,
    })),
    subtotal: item.subtotal ?? null,
    discount: item.discount ?? null,
    total: item.total ?? null,
    hasPromotionalCoupon: Boolean(item.couponId || item.cupomCode),
  }));
  return {
    tipo: metadata.tipo ?? null,
    paymentMethod: metadata.paymentMethod ?? null,
    total: metadata.total ?? metadata.amount ?? null,
    discount: metadata.discount ?? null,
    userIdPresent: Boolean(metadata.userId),
    items,
  };
}

export function plannedServicesForCarrinhoItem(item: CarrinhoRecoveryItem): string[] {
  return expandPurchaseToServiceOrders(
    Array.isArray(item.servicos) ? item.servicos : [],
    Array.isArray(item.beats) ? item.beats : []
  ).map((order) => order.serviceType);
}

export function isForbiddenAsaasFinancialStatus(status: unknown): boolean {
  const s = String(status || "").trim().toUpperCase();
  return [
    "REFUNDED",
    "REFUND_REQUESTED",
    "REFUND_IN_PROGRESS",
    "CHARGEBACK_REQUESTED",
    "CHARGEBACK_DISPUTE",
    "AWAITING_CHARGEBACK_REVERSAL",
    "DELETED",
    "OVERDUE",
    "PENDING",
    "REPROVED",
  ].includes(s);
}

export function buildConfirmedRecoveryWebhookBody(params: {
  asaasPaymentId: string;
  operationId: string;
  value: number;
  description?: string;
}): { event: string; payment: Record<string, unknown> } {
  return {
    event: RECOVERY_CONFIRMED_EVENT,
    payment: {
      id: params.asaasPaymentId,
      status: RECOVERY_CONFIRMED_STATUS,
      value: params.value,
      netValue: params.value,
      billingType: "CREDIT_CARD",
      externalReference: params.operationId,
      description: params.description || "Carrinho THouse Rec - 1 agendamento(s)",
    },
  };
}

export function planConfirmedAsaasPaymentRecovery(params: {
  operationId?: string | null;
  expectedAsaasId?: string | null;
  expectedAmount: number;
  metadata: Record<string, unknown> | null;
  storedAsaasId?: string | null;
  existingPaymentId?: string | null;
  asaasLiveStatus?: string | null;
}): RecoveryPlan {
  const event = RECOVERY_CONFIRMED_EVENT;
  const status = RECOVERY_CONFIRMED_STATUS;
  const base = {
    event,
    status,
    appointmentCount: 0,
    serviceCount: 0,
    serviceTipos: [] as string[],
    hasSchedule: false,
    couponOps: 0,
    serviceOrderOps: 0,
    expectedPaymentFields: {
      asaasIdFrom: "asaas-payment-id" as const,
      amountFrom: "asaas-value-cross-checked-with-metadata" as const,
      status: "approved" as const,
      typeInitial: "agendamento" as const,
      provider: "ASAAS" as const,
      paymentMethodOnCreate: null,
    },
  };

  if (!params.operationId?.trim()) {
    return { ...base, ok: false, abortCode: "OPERATION_ID_REQUIRED", abortMessage: "operationId é obrigatório." };
  }
  if (!params.expectedAsaasId?.trim()) {
    return { ...base, ok: false, abortCode: "ASAAS_ID_REQUIRED", abortMessage: "asaasId esperado é obrigatório." };
  }
  if (!params.metadata) {
    return { ...base, ok: false, abortCode: "METADATA_MISSING", abortMessage: "PaymentMetadata não encontrado." };
  }
  if (params.storedAsaasId && params.storedAsaasId !== params.expectedAsaasId) {
    return {
      ...base,
      ok: false,
      abortCode: "ASAAS_ID_MISMATCH",
      abortMessage: "asaasId persistido diverge do asaasId esperado.",
    };
  }
  const tipo = String(params.metadata.tipo || "").trim();
  if (tipo !== "carrinho") {
    return {
      ...base,
      ok: false,
      abortCode: "UNEXPECTED_TIPO",
      abortMessage: `tipo inesperado: ${tipo || "(vazio)"}`,
    };
  }
  const amount = metadataAmount(params.metadata);
  if (!Number.isFinite(amount) || Math.abs(amount - params.expectedAmount) > 0.01) {
    return {
      ...base,
      ok: false,
      abortCode: "AMOUNT_MISMATCH",
      abortMessage: "Valor do metadata diverge do valor esperado.",
    };
  }
  if (params.asaasLiveStatus && isForbiddenAsaasFinancialStatus(params.asaasLiveStatus)) {
    return {
      ...base,
      ok: false,
      abortCode: "REFUND_OR_CHARGEBACK",
      abortMessage: `Status Asaas incompatível: ${String(params.asaasLiveStatus)}`,
    };
  }
  if (!isOperationallyApprovedAsaasPaymentEvent(event, status)) {
    return { ...base, ok: false, abortCode: "EVENT_NOT_APPROVED", abortMessage: "Evento CONFIRMED rejeitado pelo gate." };
  }

  const items = parseItems(params.metadata);
  const scheduled = scheduledCarrinhoItems(items);
  const unscheduled = items.filter(
    (item) => !scheduled.includes(item)
  );
  const pendingTipos = unscheduled.flatMap(plannedServicesForCarrinhoItem);
  const scheduledTipos = scheduled.flatMap(plannedServicesForCarrinhoItem);

  if (scheduled.length === 0 && pendingTipos.length === 0) {
    return {
      ...base,
      ok: false,
      abortCode: "EMPTY_CART_RIGHTS",
      abortMessage: "Carrinho sem agenda e sem linhas comerciais para materializar.",
      tipo,
      expectedAmount: amount,
    };
  }

  const action = decideOperationalAsaasWebhookAction({
    event,
    status,
    existingPaymentId: params.existingPaymentId,
  });
  const resolvedAction = action === "ignore" ? "ignore" : action;

  if (scheduled.length === 0) {
    return {
      ok: true,
      action: resolvedAction,
      tipo,
      expectedAmount: amount,
      appointmentCount: 0,
      serviceCount: 0,
      serviceTipos: pendingTipos,
      appointmentTipo: String(unscheduled[0]?.tipo || "sessao"),
      hasSchedule: false,
      couponOps: pendingTipos.length,
      serviceOrderOps: pendingTipos.length,
      materialization: "pending-rights",
      event,
      status,
      expectedPaymentFields: base.expectedPaymentFields,
    };
  }

  const serviceCount = scheduled.reduce(
    (acc, item) =>
      acc +
      expectedServiceLines(
        Array.isArray(item.servicos) ? item.servicos : [],
        Array.isArray(item.beats) ? item.beats : []
      ),
    0
  );
  const promoOps = scheduled.filter((item) => Boolean(item.couponId || item.cupomCode)).length;

  return {
    ok: true,
    action: resolvedAction,
    tipo,
    expectedAmount: amount,
    appointmentCount: scheduled.length,
    serviceCount,
    serviceTipos: pendingTipos.length > 0 ? [...scheduledTipos, ...pendingTipos] : scheduledTipos,
    appointmentTipo: String(scheduled[0]?.tipo || "sessao"),
    hasSchedule: true,
    couponOps: pendingTipos.length > 0 ? pendingTipos.length : promoOps,
    serviceOrderOps: pendingTipos.length,
    materialization: pendingTipos.length > 0 ? "mixed" : "appointment-services",
    event,
    status,
    expectedPaymentFields: base.expectedPaymentFields,
  };
}
