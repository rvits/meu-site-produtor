/** IDs canônicos alinhados ao front em `agendamento/page.tsx` (serviços e beats). */
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

const PACKAGE_LABEL_ALIASES: Record<string, string> = {
  "1_beat": "beat1",
  "2_beats": "beat2",
  "3_beats": "beat3",
  "4_beats": "beat4",
  beat_mix_master: "beat_mix_master",
  "beat_+_mix_+_master": "beat_mix_master",
  producao_completa: "producao_completa",
  "producao_completa_(4h_+_beat_+_mix_+_master)": "producao_completa",
};

/** Cupons atômicos gerados por pacote composto (uma unidade do item no checkout). */
const COMPOSITE_COUPON_SPLIT: Record<string, readonly string[]> = {
  mix_master: ["mix", "master"],
  beat2: ["beat1", "beat1"],
  beat3: ["beat1", "beat1", "beat1"],
  beat4: ["beat1", "beat1", "beat1", "beat1"],
  beat_mix_master: ["beat1", "mix", "master"],
  producao_completa: ["sessao", "sessao", "beat1", "mix", "master"],
};

/**
 * Expande uma linha do agendamento nos tipos de cupom que ela deve liberar.
 * Pacotes compostos viram um cupom por tipo atômico; itens simples mantêm o próprio id.
 */
export function resolveAgendamentoItemCatalogId(
  rawId?: string | null,
  rawName?: string | null
): string {
  const candidates = [String(rawId || "").trim(), String(rawName || "").trim()].filter(Boolean);
  for (const candidate of candidates) {
    const normalized = normalizeServiceTypeId(candidate);
    if (normalized in COMPOSITE_COUPON_SPLIT) return normalized;
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
  return id in COMPOSITE_COUPON_SPLIT;
}

export function expandAgendamentoItemToCouponTypes(
  rawId: string,
  quantidade = 1,
  rawName?: string | null
): string[] {
  const id = resolveAgendamentoItemCatalogId(rawId, rawName);
  const qty = Math.max(1, Number(quantidade) || 1);
  const perUnit = COMPOSITE_COUPON_SPLIT[id] ?? [id];
  const out: string[] = [];
  for (let u = 0; u < qty; u++) {
    for (const serviceType of perUnit) {
      out.push(serviceType);
    }
  }
  return out;
}
