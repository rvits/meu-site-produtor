import {
  isSymbolicApprovedPayment,
  REFUND_ASAAS_STATUS_SIMULATED,
  type SymbolicPaymentLike,
} from "@/app/lib/symbolic-payment";

/**
 * Gate mínimo de cupom de simulação (PR-03).
 * Subconjunto autocontido — sem dependência de simulation-coupon / simulation-coupon-codes (WIP PR-04+).
 */

const ACTIVE_SIMULATION_COUPON_PREFIX = "TESTE_";

type CouponLike = {
  code: string;
  couponType?: string | null;
  refundAsaasStatus?: string | null;
  payment?: SymbolicPaymentLike | null;
  appointmentPayment?: SymbolicPaymentLike | null;
};

/** Cupom gerado por simulação / checkout simbólico (inclui reembolsos ligados a agendamento simbólico). */
export function isSimulationCoupon(coupon: CouponLike): boolean {
  if (coupon.code.startsWith(ACTIVE_SIMULATION_COUPON_PREFIX)) return true;
  if (coupon.refundAsaasStatus === REFUND_ASAAS_STATUS_SIMULATED) return true;
  if (coupon.payment && isSymbolicApprovedPayment(coupon.payment)) return true;
  if (coupon.appointmentPayment && isSymbolicApprovedPayment(coupon.appointmentPayment)) {
    return true;
  }
  return false;
}
