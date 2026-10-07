/**
 * Decisão pura do valor de reembolso parcial de carrinho.
 * Só devolve valor quando o vínculo e a granularidade são determinísticos.
 * Pacote agregado (vários serviços ou produto composto no mesmo item) não gera estorno automático.
 */
import { isCommercialCompositeProductId } from "@/app/lib/service-orders/composition";

export type PartialRefundBlockReason = "unlinked" | "aggregate" | "no_item_split";

export type CartRefundItem = {
  total: number;
  aggregate: boolean;
};

export type PartialRefundDecision = {
  amount: number;
  source: "metadata" | "single_payment" | "blocked";
  remaining: number;
  blocked: PartialRefundBlockReason | null;
};

export function parseAppointmentIds(payment: {
  appointmentId: number | null;
  appointmentIds: unknown;
}): number[] {
  let raw = payment.appointmentIds;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  const fromList: number[] = [];
  if (Array.isArray(raw)) {
    for (const value of raw) {
      const n = Number(value);
      if (Number.isFinite(n)) fromList.push(n);
    }
  }
  if (fromList.length > 0) return [...new Set(fromList)];
  if (payment.appointmentId != null && Number.isFinite(payment.appointmentId)) {
    return [payment.appointmentId];
  }
  return [];
}

function lineId(line: unknown): string {
  if (!line || typeof line !== "object" || !("id" in line)) return "";
  return String((line as { id: unknown }).id ?? "").trim();
}

export function classifyCartItem(item: Record<string, unknown>): CartRefundItem {
  const totalRaw = Number(item.total ?? item.subtotal ?? 0);
  const total = Number.isFinite(totalRaw) ? Math.round(totalRaw * 100) / 100 : 0;
  const servicos = Array.isArray(item.servicos) ? item.servicos : [];
  const beats = Array.isArray(item.beats) ? item.beats : [];
  const tipo = typeof item.tipo === "string" ? item.tipo.trim() : "";
  let aggregate =
    servicos.length > 1 ||
    beats.length > 1 ||
    (servicos.length > 0 && beats.length > 0) ||
    (tipo !== "" && isCommercialCompositeProductId(tipo));
  for (const line of [...servicos, ...beats]) {
    const id = lineId(line);
    if (id && isCommercialCompositeProductId(id)) aggregate = true;
  }
  return { total, aggregate };
}

export function parseCartRefundItems(metadataJson: string | null | undefined): CartRefundItem[] | null {
  if (!metadataJson) return null;
  try {
    const parsed = JSON.parse(metadataJson) as Record<string, unknown>;
    let items: unknown = parsed.items;
    if (typeof items === "string") items = JSON.parse(items);
    if (!Array.isArray(items) || items.length === 0) return null;
    return items.map((item) =>
      classifyCartItem(item && typeof item === "object" ? (item as Record<string, unknown>) : {})
    );
  } catch {
    return null;
  }
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function finish(
  requested: number,
  paymentAmount: number,
  alreadyRefunded: number,
  source: "metadata" | "single_payment"
): PartialRefundDecision {
  const remaining = Math.max(0, roundMoney(paymentAmount - alreadyRefunded));
  const amount = roundMoney(Math.min(requested, remaining));
  return { amount, source, remaining, blocked: null };
}

export function blockedPartialRefund(
  reason: PartialRefundBlockReason,
  paymentAmount: number,
  alreadyRefunded: number
): PartialRefundDecision {
  return {
    amount: 0,
    source: "blocked",
    remaining: Math.max(0, roundMoney(paymentAmount - alreadyRefunded)),
    blocked: reason,
  };
}

/**
 * `direct`: o Payment cobre este Appointment por appointmentId ou appointmentIds.
 * `coupon_root`: o Payment foi localizado pelo pedido raiz do cupom. Nesse caso
 * só há estorno automático quando o pagamento é um único serviço atômico.
 */
export function decideCartPartialRefund(input: {
  paymentAmount: number;
  appointmentIds: number[];
  appointmentId: number;
  items: CartRefundItem[] | null;
  alreadyRefunded: number;
  link: "direct" | "coupon_root";
}): PartialRefundDecision {
  const ids = [...new Set(input.appointmentIds.filter((id) => Number.isFinite(id)))];
  const items = input.items;
  const block = (reason: PartialRefundBlockReason) =>
    blockedPartialRefund(reason, input.paymentAmount, input.alreadyRefunded);

  if (input.link === "direct" && !ids.includes(input.appointmentId)) {
    return block("unlinked");
  }

  if (input.link === "coupon_root") {
    if (items?.some((item) => item.aggregate)) return block("aggregate");
    if (items != null && items.length === 1) {
      const requested = items[0]!.total > 0 ? items[0]!.total : input.paymentAmount;
      return finish(requested, input.paymentAmount, input.alreadyRefunded, "metadata");
    }
    if (items == null && ids.length <= 1) {
      return finish(input.paymentAmount, input.paymentAmount, input.alreadyRefunded, "single_payment");
    }
    return block("no_item_split");
  }

  if (items == null || items.length === 0) {
    if (ids.length === 1 && ids[0] === input.appointmentId) {
      return finish(input.paymentAmount, input.paymentAmount, input.alreadyRefunded, "single_payment");
    }
    return block("no_item_split");
  }

  if (ids.length === 1 && items.length === 1) {
    if (items[0]!.aggregate) return block("aggregate");
    const requested = items[0]!.total > 0 ? items[0]!.total : input.paymentAmount;
    return finish(requested, input.paymentAmount, input.alreadyRefunded, "metadata");
  }

  if (ids.length === items.length) {
    if (items.some((item) => item.aggregate)) return block("aggregate");
    const index = ids.indexOf(input.appointmentId);
    const item = index >= 0 ? items[index] : undefined;
    if (!item || item.total <= 0) return block("no_item_split");
    return finish(item.total, input.paymentAmount, input.alreadyRefunded, "metadata");
  }

  return block("no_item_split");
}
