/**
 * Status financeiro do provedor Asaas vs status operacional interno (Payment.status).
 * Não autoriza materialização — só persiste/apresenta o último status conhecido.
 */

const CHECKOUT_PAYMENT_METHODS = new Set([
  "cartao_credito",
  "cartao_debito",
  "pix",
  "boleto",
  "cupom",
]);

export function normalizeAsaasPaymentStatus(value: unknown): string | null {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase();
  if (!raw) return null;
  if (raw.length > 64 || !/^[A-Z][A-Z0-9_]*$/.test(raw)) return null;
  return raw;
}

/**
 * Asaas não garante ordem se a entrega não for sequencial (replay / fila).
 * Regra mínima (sem FSM completa):
 * - RECEIVED não regride para CONFIRMED nem PENDING
 * - CONFIRMED não regride para PENDING
 */
export function nextAsaasPaymentStatus(
  current: string | null | undefined,
  incoming: unknown
): string | null {
  const next = normalizeAsaasPaymentStatus(incoming);
  const cur = normalizeAsaasPaymentStatus(current);
  if (!next) return cur;
  if (cur === "RECEIVED" && (next === "CONFIRMED" || next === "PENDING")) {
    return "RECEIVED";
  }
  if (cur === "CONFIRMED" && next === "PENDING") {
    return "CONFIRMED";
  }
  return next;
}

export function checkoutPaymentMethodFromMetadata(
  metadata: Record<string, unknown> | null | undefined
): string | null {
  if (!metadata) return null;
  const raw = String(metadata.paymentMethod ?? "").trim();
  if (!raw) return null;
  return CHECKOUT_PAYMENT_METHODS.has(raw) ? raw : null;
}

export function presentInternalPaymentStatus(status: string | null | undefined): string {
  switch (String(status || "").trim().toLowerCase()) {
    case "approved":
      return "Aprovado";
    case "pending":
    case "pendente":
      return "Pendente";
    case "rejected":
    case "rejeitado":
      return "Rejeitado";
    case "refunded":
    case "reembolsado":
      return "Reembolsado";
    case "cancelled":
    case "canceled":
    case "cancelado":
      return "Cancelado";
    case "failed":
    case "falhou":
      return "Falhou";
    default:
      return String(status || "").trim() || "—";
  }
}

export function internalPaymentStatusBadgeClass(status: string | null | undefined): string {
  const s = String(status || "").trim().toLowerCase();
  if (s === "approved") return "bg-green-500/20 text-green-300";
  if (s === "pending" || s === "pendente") return "bg-yellow-500/20 text-yellow-300";
  if (s === "rejected" || s === "rejeitado" || s === "failed" || s === "falhou") {
    return "bg-red-500/20 text-red-300";
  }
  if (s === "refunded" || s === "reembolsado") return "bg-orange-500/20 text-orange-300";
  if (s === "cancelled" || s === "canceled" || s === "cancelado") {
    return "bg-zinc-500/20 text-zinc-300";
  }
  return "bg-gray-500/20 text-gray-300";
}

/** Só estados com tradução oficial; null = não mostrar badge financeiro Asaas. */
export function presentAsaasPaymentStatusLabel(
  asaasPaymentStatus: string | null | undefined
): string | null {
  const s = normalizeAsaasPaymentStatus(asaasPaymentStatus);
  if (s === "CONFIRMED") return "Confirmado";
  if (s === "RECEIVED") return "Recebido";
  return null;
}

export function getAsaasPaymentStatusPresentation(
  asaasPaymentStatus: string | null | undefined
): { label: string | null; showBadge: boolean } {
  const label = presentAsaasPaymentStatusLabel(asaasPaymentStatus);
  return { label, showBadge: Boolean(label) };
}

export function asaasPaymentStatusBadgeClass(
  asaasPaymentStatus: string | null | undefined
): string {
  const s = normalizeAsaasPaymentStatus(asaasPaymentStatus);
  if (s === "RECEIVED") return "bg-emerald-500/20 text-emerald-200";
  if (s === "CONFIRMED") return "bg-teal-500/20 text-teal-200";
  return "bg-zinc-500/20 text-zinc-300";
}

export function presentCheckoutPaymentMethod(
  paymentMethod: string | null | undefined
): string {
  switch (String(paymentMethod || "").trim()) {
    case "cartao_credito":
      return "Cartão de Crédito";
    case "cartao_debito":
      return "Cartão de Débito";
    case "pix":
      return "Pix";
    case "boleto":
      return "Boleto Bancário";
    case "cupom":
      return "Cupom";
    default:
      return "Não informado";
  }
}
