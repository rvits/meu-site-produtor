/**
 * Compensação administrativa de um agendamento recusado ou cancelado.
 * Fecha cupom e reembolso sem criar Coupon e sem chamar o Asaas.
 * Os três campos do Appointment são a fonte persistente da ação.
 */

export const MANUAL_COMPENSATION_OPTION = "manual" as const;

export const MANUAL_COMPENSATION_REASON_MAX = 500;

export const CLIENT_MANUAL_COMPENSATION_LABEL =
  "Solicitação compensada administrativamente.";

export const ADMIN_MANUAL_COMPENSATION_LABEL = "Compensado administrativamente";

const ELIGIBLE_STATUSES = new Set(["recusado", "cancelado"]);

/** Limpeza atômica ao reabrir cancelado/remarcado para aceito. */
export const appointmentReopenResolutionClear = {
  cancelReason: null,
  cancelledAt: null,
  cancelRefundOption: null,
  refundProcessedAt: null,
  refundCouponId: null,
  manualCompensationAt: null,
  manualCompensationBy: null,
  manualCompensationReason: null,
} as const;

export type ManualCompensationDecision =
  | { outcome: "applied" }
  | { outcome: "already_manual" }
  | { outcome: "conflict"; option: string }
  | { outcome: "not_found" }
  | { outcome: "ineligible_status" }
  | { outcome: "invalid_reason" };

export function parseManualCompensationReason(
  raw: unknown
): { ok: true; reason: string | null } | { ok: false } {
  if (raw == null) return { ok: true, reason: null };
  if (typeof raw !== "string") return { ok: false };
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, reason: null };
  if (trimmed.length > MANUAL_COMPENSATION_REASON_MAX) return { ok: false };
  return { ok: true, reason: trimmed };
}

type AppointmentResolutionSnapshot = {
  status?: string | null;
  cancelRefundOption?: string | null;
};

/**
 * Interpreta o resultado de um update condicional (count 0 ou 1)
 * sem autorizar um segundo UPDATE irrestrito.
 */
export function decideManualCompensation(input: {
  updatedCount: number;
  appointment: AppointmentResolutionSnapshot | null;
}): ManualCompensationDecision {
  if (input.updatedCount === 1) return { outcome: "applied" };
  if (!input.appointment) return { outcome: "not_found" };
  const option = input.appointment.cancelRefundOption;
  if (option === MANUAL_COMPENSATION_OPTION) return { outcome: "already_manual" };
  if (option === "cupom" || option === "reembolso") {
    return { outcome: "conflict", option };
  }
  if (option) return { outcome: "conflict", option };
  const status = String(input.appointment.status ?? "").toLowerCase();
  if (!ELIGIBLE_STATUSES.has(status)) return { outcome: "ineligible_status" };
  return { outcome: "conflict", option: "desconhecido" };
}

export function isManualCompensation(option: string | null | undefined): boolean {
  return option === MANUAL_COMPENSATION_OPTION;
}

/** A Minha Conta só oferece escolha enquanto nenhuma resolução foi gravada. */
export function clientRefundChoiceVisible(input: {
  status: string | null | undefined;
  cancelRefundOption: string | null | undefined;
}): boolean {
  const status = String(input.status ?? "").toLowerCase();
  if (!ELIGIBLE_STATUSES.has(status)) return false;
  return input.cancelRefundOption == null || input.cancelRefundOption === "";
}

export function adminResolutionLabel(option: string | null | undefined): string | null {
  if (option === "reembolso") return "Reembolso direto (Asaas)";
  if (option === "cupom") return "Cupom de remarcação";
  if (option === MANUAL_COMPENSATION_OPTION) return ADMIN_MANUAL_COMPENSATION_LABEL;
  return null;
}

/** Remove a auditoria administrativa do payload enviado ao cliente. */
export function omitManualCompensationAudit<T extends {
  manualCompensationAt?: unknown;
  manualCompensationBy?: unknown;
  manualCompensationReason?: unknown;
}>(row: T): Omit<T, "manualCompensationAt" | "manualCompensationBy" | "manualCompensationReason"> {
  const copy = { ...row };
  delete copy.manualCompensationAt;
  delete copy.manualCompensationBy;
  delete copy.manualCompensationReason;
  return copy;
}

export function clientResolutionLabel(option: string | null | undefined): string | null {
  if (option === "reembolso") return "Reembolso direto (Asaas)";
  if (option === "cupom") return "Cupom para remarcar";
  if (option === MANUAL_COMPENSATION_OPTION) return CLIENT_MANUAL_COMPENSATION_LABEL;
  return null;
}
