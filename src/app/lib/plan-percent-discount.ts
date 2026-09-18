/**
 * Política canônica dos cupons percentuais de plano:
 * - percent_servicos: 10% sobre o SUBTOTAL de SKUs comerciais de estúdio elegíveis.
 * - percent_beats: 10% sobre UMA unidade do SKU Beat elegível de maior valor comercial.
 *
 * Preços vêm do CHECKOUT_CATALOG (backend), nunca do browser.
 */
import {
  CHECKOUT_CATALOG,
  resolveCanonicalServiceId,
  type CanonicalServiceId,
} from "@/app/lib/service-catalog";

export const PERCENT_SERVICOS_ELIGIBLE_SKUS = [
  "sessao",
  "captacao",
  "mix",
  "master",
  "mix_master",
  "sonoplastia",
] as const satisfies readonly CanonicalServiceId[];

/** Pacotes comerciais de Beat avulso — não inclui compostos com mix/master. */
export const PERCENT_BEATS_ELIGIBLE_SKUS = [
  "beat1",
  "beat2",
  "beat3",
  "beat4",
] as const satisfies readonly CanonicalServiceId[];

const SERVICOS_SET = new Set<string>(PERCENT_SERVICOS_ELIGIBLE_SKUS);
const BEATS_SET = new Set<string>(PERCENT_BEATS_ELIGIBLE_SKUS);

export type PercentDiscountLine = { id?: string; quantidade?: number; preco?: number };

export type PlanPercentKind = "percent_servicos" | "percent_beats";

export function roundMoneyBRL(value: number): number {
  return Math.round(value * 100) / 100;
}

export function catalogUnitPrice(id: CanonicalServiceId): number {
  return CHECKOUT_CATALOG[id].preco;
}

export function resolvePlanPercentKind(
  serviceType?: string | null
): PlanPercentKind | null {
  const st = String(serviceType || "").trim();
  if (st === "percent_servicos") return "percent_servicos";
  if (st === "percent_beats") return "percent_beats";
  return null;
}

function canonicalLineSku(line: PercentDiscountLine): CanonicalServiceId | null {
  return resolveCanonicalServiceId(String(line.id || ""));
}

function lineQty(line: PercentDiscountLine): number {
  const q = Number(line.quantidade);
  return Number.isFinite(q) && q > 0 ? q : 0;
}

export function eligibleServicosSubtotal(lines: PercentDiscountLine[]): number {
  let sum = 0;
  for (const line of lines) {
    const id = canonicalLineSku(line);
    if (!id || !SERVICOS_SET.has(id)) continue;
    sum += catalogUnitPrice(id) * lineQty(line);
  }
  return roundMoneyBRL(sum);
}

export type BeatDiscountUnit = {
  sku: CanonicalServiceId;
  unitPrice: number;
  sequence: number;
};

/** Uma entrada por unidade comercial (qty 2 → duas unidades). */
export function listEligibleBeatUnits(lines: PercentDiscountLine[]): BeatDiscountUnit[] {
  const units: BeatDiscountUnit[] = [];
  let sequence = 0;
  for (const line of lines) {
    const id = canonicalLineSku(line);
    if (!id || !BEATS_SET.has(id)) continue;
    const qty = lineQty(line);
    const unitPrice = catalogUnitPrice(id);
    for (let i = 0; i < qty; i++) {
      units.push({ sku: id, unitPrice, sequence: sequence++ });
    }
  }
  return units;
}

/** Empate: maior preço; depois SKU estável; depois ordem de ocorrência. */
export function pickHighestBeatDiscountUnit(
  units: BeatDiscountUnit[]
): BeatDiscountUnit | null {
  if (units.length === 0) return null;
  const sorted = [...units].sort((a, b) => {
    if (b.unitPrice !== a.unitPrice) return b.unitPrice - a.unitPrice;
    if (a.sku !== b.sku) return a.sku.localeCompare(b.sku);
    return a.sequence - b.sequence;
  });
  return sorted[0] ?? null;
}

export const PERCENT_SERVICOS_REJECT_MESSAGE =
  "Este cupom de 10% em serviços vale para sessão, captação, mix, master, Mix + Master e sonoplastia. Inclua ao menos um desses itens.";

export const PERCENT_BEATS_REJECT_MESSAGE =
  "Este cupom de 10% em Beats vale apenas para 1 Beat, 2 Beats, 3 Beats ou 4 Beats. Não se aplica a Beat + Mix + Master nem à Produção Completa.";

export type PlanPercentDiscountResult =
  | {
      ok: true;
      kind: PlanPercentKind;
      base: number;
      discount: number;
      chosenSku: CanonicalServiceId | null;
    }
  | { ok: false; error: string };

export function computePlanPercentDiscount(params: {
  serviceType?: string | null;
  percent: number;
  maxDiscount?: number | null;
  services?: PercentDiscountLine[] | null;
  beats?: PercentDiscountLine[] | null;
}): PlanPercentDiscountResult {
  const kind = resolvePlanPercentKind(params.serviceType);
  if (!kind) {
    return { ok: false, error: "Tipo de cupom percentual de plano não reconhecido." };
  }
  const percent = Number(params.percent);
  if (!Number.isFinite(percent) || percent <= 0) {
    return { ok: false, error: "Percentual de desconto inválido." };
  }

  const services = Array.isArray(params.services) ? params.services : [];
  const beats = Array.isArray(params.beats) ? params.beats : [];
  const all = [...services, ...beats];

  if (kind === "percent_servicos") {
    const base = eligibleServicosSubtotal(all);
    if (base <= 0) {
      return { ok: false, error: PERCENT_SERVICOS_REJECT_MESSAGE };
    }
    let discount = roundMoneyBRL((base * percent) / 100);
    if (params.maxDiscount != null && discount > params.maxDiscount) {
      discount = roundMoneyBRL(Number(params.maxDiscount));
    }
    if (discount > base) discount = base;
    return { ok: true, kind, base, discount, chosenSku: null };
  }

  const chosen = pickHighestBeatDiscountUnit(listEligibleBeatUnits(all));
  if (!chosen) {
    return { ok: false, error: PERCENT_BEATS_REJECT_MESSAGE };
  }
  const base = chosen.unitPrice;
  let discount = roundMoneyBRL((base * percent) / 100);
  if (params.maxDiscount != null && discount > params.maxDiscount) {
    discount = roundMoneyBRL(Number(params.maxDiscount));
  }
  if (discount > base) discount = base;
  return { ok: true, kind, base, discount, chosenSku: chosen.sku };
}
