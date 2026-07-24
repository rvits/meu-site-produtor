import {
  getOfficialPackageComposition,
  isOfficialPackageId,
  OFFICIAL_PACKAGE_COMPOSITION,
  PACKAGE_CATALOG_LABELS,
} from "@/app/lib/package-composition";

/** IDs que exigem data/hora de estúdio (agenda presencial). */
export const SCHEDULABLE_SERVICE_IDS = new Set<string>(["sessao", "captacao"]);

export const CANONICAL_SERVICE_IDS = [
  "sessao",
  "captacao",
  "sonoplastia",
  "mix",
  "master",
  "mix_master",
  "beat1",
  "beat2",
  "beat3",
  "beat4",
  "beat_mix_master",
  "producao_completa",
] as const;

export type CanonicalServiceId = (typeof CANONICAL_SERVICE_IDS)[number];

export type CheckoutCatalogItem = {
  id: CanonicalServiceId;
  nome: string;
  preco: number;
  category: "service" | "beat";
};

/** Fonte financeira oficial para checkouts. O browser nunca define preços. */
export const CHECKOUT_CATALOG: Record<CanonicalServiceId, CheckoutCatalogItem> = {
  sessao: { id: "sessao", nome: "Sessão", preco: 40, category: "service" },
  captacao: { id: "captacao", nome: "Captação", preco: 55, category: "service" },
  sonoplastia: { id: "sonoplastia", nome: "Sonoplastia", preco: 350, category: "service" },
  mix: { id: "mix", nome: "Mixagem", preco: 110, category: "service" },
  master: { id: "master", nome: "Masterização", preco: 80, category: "service" },
  mix_master: {
    id: "mix_master",
    nome: PACKAGE_CATALOG_LABELS.mix_master ?? "Mix + Master",
    preco: 170,
    category: "service",
  },
  beat1: { id: "beat1", nome: "1 Beat", preco: 150, category: "beat" },
  beat2: {
    id: "beat2",
    nome: PACKAGE_CATALOG_LABELS.beat2 ?? "2 Beats",
    preco: 250,
    category: "beat",
  },
  beat3: {
    id: "beat3",
    nome: PACKAGE_CATALOG_LABELS.beat3 ?? "3 Beats",
    preco: 350,
    category: "beat",
  },
  beat4: {
    id: "beat4",
    nome: PACKAGE_CATALOG_LABELS.beat4 ?? "4 Beats",
    preco: 400,
    category: "beat",
  },
  beat_mix_master: {
    id: "beat_mix_master",
    nome: PACKAGE_CATALOG_LABELS.beat_mix_master ?? "Beat + Mix + Master",
    preco: 320,
    category: "beat",
  },
  producao_completa: {
    id: "producao_completa",
    nome:
      PACKAGE_CATALOG_LABELS.producao_completa ??
      "Produção Completa (2h Sessão + 2h Captação + Beat + Mix + Master)",
    preco: 450,
    category: "beat",
  },
};

export type CheckoutItemRequest = { id: string; quantidade?: number };
export type PricedCheckoutItem = CheckoutCatalogItem & { quantidade: number };

export function priceCheckoutItems(
  items: CheckoutItemRequest[] | undefined,
  expectedCategory?: "service" | "beat"
): PricedCheckoutItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((item) => {
    const id = normalizeServiceTypeId(item.id) as CanonicalServiceId;
    const catalogItem = CHECKOUT_CATALOG[id];
    if (!catalogItem || (expectedCategory && catalogItem.category !== expectedCategory)) {
      throw new Error(`ITEM_CATALOGO_INVALIDO:${item.id}`);
    }
    const quantidade = Number(item.quantidade);
    if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > 20) {
      throw new Error(`QUANTIDADE_INVALIDA:${item.id}`);
    }
    return { ...catalogItem, quantidade };
  });
}

export function totalPricedCheckoutItems(items: PricedCheckoutItem[]): number {
  return Math.round(
    items.reduce((sum, item) => sum + item.preco * item.quantidade, 0) * 100
  ) / 100;
}

/**
 * Normaliza o tipo gravado no cupom/serviço para o id estável do catálogo.
 */
export function normalizeServiceTypeId(raw: string): string {
  const s = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
  if (!s) return "sessao";
  const aliases: Record<string, string> = {
    mixagem: "mix",
    masterizacao: "master",
    masterização: "master",
    mix_e_master: "mix_master",
    "mix+master": "mix_master",
    sessão: "sessao",
    captacao: "captacao",
    captação: "captacao",
  };
  return aliases[s] || s;
}

export function isSchedulableServiceType(rawId?: string | null, rawName?: string | null): boolean {
  const id = normalizeServiceTypeId(String(rawId || rawName || ""));
  return SCHEDULABLE_SERVICE_IDS.has(id);
}

const PACKAGE_LABEL_ALIASES: Record<string, string> = {
  "1_beat": "beat1",
  "2_beats": "beat2",
  "3_beats": "beat3",
  "4_beats": "beat4",
  beat_mix_master: "beat_mix_master",
  "beat_+_mix_+_master": "beat_mix_master",
  producao_completa: "producao_completa",
  "producao_completa_(4h_+_beat_+_mix_+_master)": "producao_completa",
  "producao_completa_(2h_sessao_+_2h_captacao_+_beat_+_mix_+_master)":
    "producao_completa",
};

/**
 * Expande uma linha do agendamento nos tipos de cupom que ela deve liberar.
 * Pacotes compostos usam OFFICIAL_PACKAGE_COMPOSITION; itens simples mantêm o próprio id.
 */
export function resolveAgendamentoItemCatalogId(
  rawId?: string | null,
  rawName?: string | null
): string {
  const candidates = [String(rawId || "").trim(), String(rawName || "").trim()].filter(Boolean);
  for (const candidate of candidates) {
    const normalized = normalizeServiceTypeId(candidate);
    if (isOfficialPackageId(normalized)) return normalized;
    if ((CANONICAL_SERVICE_IDS as readonly string[]).includes(normalized)) return normalized;
    const fromLabel = PACKAGE_LABEL_ALIASES[normalized];
    if (fromLabel) return fromLabel;
  }
  return normalizeServiceTypeId(String(rawId || rawName || "sessao"));
}

export function isMultiCouponAgendamentoPackageId(
  rawId?: string | null,
  rawName?: string | null
): boolean {
  const id = resolveAgendamentoItemCatalogId(rawId, rawName);
  return isOfficialPackageId(id);
}

export function expandAgendamentoItemToCouponTypes(
  rawId: string,
  quantidade = 1,
  rawName?: string | null
): string[] {
  const id = resolveAgendamentoItemCatalogId(rawId, rawName);
  const qty = Math.max(1, Number(quantidade) || 1);
  const perUnit = getOfficialPackageComposition(id) ?? [id];
  const out: string[] = [];
  for (let u = 0; u < qty; u++) {
    for (const serviceType of perUnit) {
      out.push(serviceType);
    }
  }
  return out;
}

/** Reexport para consumidores que leem a composição oficial junto do catálogo. */
export { OFFICIAL_PACKAGE_COMPOSITION };
