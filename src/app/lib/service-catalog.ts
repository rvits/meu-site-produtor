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
