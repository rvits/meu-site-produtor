/**
 * OP-02B — Homologation scenarios smoke (catálogo + tipos).
 * Não executa DB; valida que todos os cenários exigidos existem.
 */
import {
  HOMOLOGATION_SCENARIOS,
  type HomologationScenarioId,
} from "../src/app/lib/homologation/scenarios";

const REQUIRED: HomologationScenarioId[] = [
  "sessao",
  "beat",
  "sessao_beat",
  "plano_bronze",
  "plano_prata",
  "plano_ouro",
  "cupom_desconto",
  "cupom_remarcacao",
  "refund_approved",
  "refund_failed",
  "refund_pending",
  "refund_timeout",
];

const ids = new Set(HOMOLOGATION_SCENARIOS.map((s) => s.id));
const missing = REQUIRED.filter((id) => !ids.has(id));
const refundOutcomes = ["APPROVED", "FAILED", "PENDING", "TIMEOUT"] as const;
const refundOk = refundOutcomes.every((o) =>
  HOMOLOGATION_SCENARIOS.some((s) => s.refundOutcome === o || s.id === `refund_${o.toLowerCase()}`)
);

if (missing.length || !refundOk) {
  console.error("[homologation-scenarios] FAIL", { missing, refundOk });
  process.exit(1);
}

console.log(
  `[homologation-scenarios] PASS — ${HOMOLOGATION_SCENARIOS.length} cenários (${REQUIRED.length} obrigatórios)`
);
