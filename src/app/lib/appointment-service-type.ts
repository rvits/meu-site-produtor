/**
 * Identidade atômica de UM Appointment a partir do item/direito.
 * Nunca usa "sessao" como fallback. Nunca escolhe orders[0] em multi-right.
 */
import {
  isAtomicServiceTypeId,
  normalizeServiceTypeId,
  requireAtomicServiceTypeId,
  type AtomicServiceTypeId,
} from "@/app/lib/service-catalog";
import {
  expandPurchaseToServiceOrders,
  purchaseOpensImmediateSchedule,
  type PurchaseLine,
} from "@/app/lib/service-orders/expand";

export class InvalidAtomicServiceTypeError extends Error {
  readonly raw: string;
  constructor(raw: string) {
    super(`TIPO_SERVICO_INVALIDO:${raw}`);
    this.name = "InvalidAtomicServiceTypeError";
    this.raw = raw;
  }
}

export class MultipleAtomicOrdersError extends Error {
  readonly orderCount: number;
  constructor(orderCount: number) {
    super("TIPO_SERVICO_MULTIPLO");
    this.name = "MultipleAtomicOrdersError";
    this.orderCount = orderCount;
  }
}

export type DeriveAppointmentTipoInput = {
  services?: PurchaseLine[] | null;
  beats?: PurchaseLine[] | null;
  couponServiceType?: string | null;
  /** Informativo; nunca sobrescreve o tipo derivado das linhas/direito. */
  clientTipo?: string | null;
};

function lines(input: DeriveAppointmentTipoInput): {
  services: PurchaseLine[];
  beats: PurchaseLine[];
} {
  return {
    services: Array.isArray(input.services) ? input.services : [],
    beats: Array.isArray(input.beats) ? input.beats : [],
  };
}

function requireAtomicOrWrap(raw: string): AtomicServiceTypeId {
  try {
    return requireAtomicServiceTypeId(raw);
  } catch {
    throw new InvalidAtomicServiceTypeError(raw);
  }
}

/**
 * Tipo de UM Appointment. Exige exatamente 1 direito atômico
 * (linhas expandem para 1 ordem, ou cupom.serviceType se não houver linhas).
 */
export function deriveAppointmentTipoFromPurchase(
  input: DeriveAppointmentTipoInput
): AtomicServiceTypeId {
  const { services, beats } = lines(input);
  const orders = expandPurchaseToServiceOrders(services, beats);
  if (orders.length > 1) {
    throw new MultipleAtomicOrdersError(orders.length);
  }
  if (orders.length === 1) {
    return requireAtomicOrWrap(String(orders[0].serviceType || ""));
  }

  const couponRaw = String(input.couponServiceType || "").trim();
  if (couponRaw) {
    return requireAtomicOrWrap(couponRaw);
  }

  throw new InvalidAtomicServiceTypeError(String(input.clientTipo || ""));
}

export function tryDeriveAppointmentTipoFromPurchase(
  input: DeriveAppointmentTipoInput
): AtomicServiceTypeId | null {
  try {
    return deriveAppointmentTipoFromPurchase(input);
  } catch {
    return null;
  }
}

/** Campo metadata.tipoAgendamento: ausente em multi-right; lança se tipo inválido. */
export function optionalSingleAppointmentTipoForMetadata(
  input: DeriveAppointmentTipoInput
): AtomicServiceTypeId | undefined {
  try {
    return deriveAppointmentTipoFromPurchase(input);
  } catch (error) {
    if (error instanceof MultipleAtomicOrdersError) return undefined;
    throw error;
  }
}

/** true quando o cliente pediu sessao mas o item/direito é outro atômico. */
export function clientTipoConflictsWithDerived(
  clientTipo: string | null | undefined,
  derived: AtomicServiceTypeId
): boolean {
  const normalized = normalizeServiceTypeId(String(clientTipo || ""));
  if (!normalized) return false;
  if (!isAtomicServiceTypeId(normalized)) return true;
  return normalized !== derived;
}

/**
 * Espelha o gate server-side do carrinho: data+hora não materializam
 * Appointment se o item expandir para mais de uma ordem.
 */
export function itemOpensImmediateAppointment(item: {
  services?: PurchaseLine[] | null;
  beats?: PurchaseLine[] | null;
  data?: string | null;
  hora?: string | null;
  somenteCupons?: boolean;
}): boolean {
  if (item.somenteCupons === true) return false;
  if (!String(item.data || "").trim() || !String(item.hora || "").trim()) return false;
  const services = Array.isArray(item.services) ? item.services : [];
  const beats = Array.isArray(item.beats) ? item.beats : [];
  return purchaseOpensImmediateSchedule(services, beats);
}
