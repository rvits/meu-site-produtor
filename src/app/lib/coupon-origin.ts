export type CouponOrigin = "plano" | "agendamento" | "reembolso";

export function resolveCouponOrigin(coupon: {
  couponType?: string | null;
  paymentId?: string | null;
  userPlanId?: string | null;
}): CouponOrigin {
  const raw = String(coupon.couponType || "").trim().toLowerCase();
  if (raw === "reembolso") return "reembolso";
  if (raw === "agendamento") return "agendamento";
  if (coupon.userPlanId) return "plano";
  if (coupon.paymentId) return "agendamento";
  if (raw === "plano") return "plano";
  return "plano";
}

export function couponOriginLabel(origin: CouponOrigin): string {
  if (origin === "agendamento") return "Agendamento";
  if (origin === "reembolso") return "Reembolso";
  return "Plano";
}

export function resolveAppointmentOrigin(params: {
  pagamento: { type?: string | null } | null;
  foiComCupomPlano?: boolean;
  cupons?: {
    couponType?: string | null;
    paymentId?: string | null;
    userPlanId?: string | null;
  }[];
}): CouponOrigin {
  const cupons = params.cupons ?? [];
  const temCupomReembolso = cupons.some((cupom) => resolveCouponOrigin(cupom) === "reembolso");
  const temCupomPlano = cupons.some(
    (cupom) => resolveCouponOrigin(cupom) === "plano" && cupom.userPlanId
  );
  const temCupomAgendamento = cupons.some((cupom) => resolveCouponOrigin(cupom) === "agendamento");

  if (temCupomReembolso) return "reembolso";
  if (temCupomPlano || params.foiComCupomPlano) return "plano";
  if (params.pagamento?.type === "agendamento" || temCupomAgendamento || params.pagamento) {
    return "agendamento";
  }
  return "agendamento";
}
