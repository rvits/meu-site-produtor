/**
 * GO-H4 / GO-H4.3 — Composição oficial dos pacotes (fonte única do domínio).
 * Obrigatória para: checkout, cupons, Asaas, SimulationProvider, Homologação,
 * reembolsos, planos, agendamentos, dashboard e administração.
 * Nunca gerar cupom genérico do pacote.
 */

/** Tipos atômicos liberados por uma unidade de cada pacote composto. */
export const OFFICIAL_PACKAGE_COMPOSITION = {
  mix_master: ["mix", "master"],
  beat2: ["beat1", "beat1"],
  beat3: ["beat1", "beat1", "beat1"],
  beat4: ["beat1", "beat1", "beat1", "beat1"],
  beat_mix_master: ["beat1", "mix", "master"],
  /**
   * Produção Completa:
   * 2h Sessão + 2h Captação + 1 Beat + 1 Mixagem + 1 Masterização
   * → 2 cupons Sessão (1h) + 2 cupons Captação (1h) + Beat + Mix + Master
   */
  producao_completa: ["sessao", "sessao", "captacao", "captacao", "beat1", "mix", "master"],
} as const satisfies Record<string, readonly string[]>;

export type OfficialPackageId = keyof typeof OFFICIAL_PACKAGE_COMPOSITION;

export const OFFICIAL_PACKAGE_IDS = Object.keys(
  OFFICIAL_PACKAGE_COMPOSITION
) as OfficialPackageId[];

/** Descrição comercial alinhada à composição operacional. */
export const PACKAGE_CATALOG_LABELS: Partial<Record<OfficialPackageId, string>> = {
  mix_master: "Mix + Master",
  beat2: "2 Beats",
  beat3: "3 Beats",
  beat4: "4 Beats",
  beat_mix_master: "Beat + Mix + Master",
  producao_completa:
    "Produção Completa (2h Sessão + 2h Captação + Beat + Mix + Master)",
};

export function getOfficialPackageComposition(
  packageId: string
): readonly string[] | null {
  const entry = OFFICIAL_PACKAGE_COMPOSITION[packageId as OfficialPackageId];
  return entry ?? null;
}

export function isOfficialPackageId(id: string): id is OfficialPackageId {
  return id in OFFICIAL_PACKAGE_COMPOSITION;
}
