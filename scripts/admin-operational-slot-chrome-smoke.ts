/**
 * Smoke — chrome de slot/duração visual ≠ cronômetro operacional.
 * Sem Prisma. A UI admin/portal deve usar hasOperationalTimer(tipo),
 * nunca duracaoMinutos / existência de appointment.
 */
import assert from "node:assert/strict";
import {
  hasOperationalTimer,
  resolveServiceTiming,
} from "../src/app/lib/service-timing";
import { mapTimingHistoryItem } from "../src/app/lib/admin-stats-timing";
import { COMMERCIAL_PRODUCT_COMPOSITION } from "../src/app/lib/service-orders/composition";
import { buildOrderTimeline } from "../src/app/minha-conta/portal-ui/OrderTimeline";
import type { Agendamento } from "../src/app/minha-conta/portal-ui/types";

function cardShowsReservedDuration(tipo: string) {
  return hasOperationalTimer(tipo);
}

const TIMER_ON = ["sessao", "Sessão", "captacao", "Captação"] as const;
const TIMER_OFF = [
  "mix",
  "master",
  "beat1",
  "beat",
  "sonoplastia",
  "producao_completa",
  "tipo_desconhecido",
  "",
] as const;

for (const tipo of TIMER_ON) {
  assert.equal(cardShowsReservedDuration(tipo), true, `${tipo} chrome SIM`);
}

for (const tipo of TIMER_OFF) {
  assert.equal(cardShowsReservedDuration(tipo), false, `${tipo} duration 60 + apt ≠ chrome`);
}

const mixRunning = resolveServiceTiming({
  tipo: "mix",
  status: "em_andamento",
  startedAt: new Date("2026-10-01T12:00:00-03:00"),
});
assert.equal(mixRunning.applicable, false, "Mix em_andamento com startedAt residual sem cronômetro");
assert.equal(mixRunning.running, false);

assert.equal(
  mapTimingHistoryItem({
    id: "x",
    tipo: "producao_completa",
    status: "concluido",
    actualDurationSeconds: 7200,
  }),
  null,
  "SKU producao_completa sem histórico de timer"
);

const expanded = COMMERCIAL_PRODUCT_COMPOSITION.producao_completa;
assert.deepEqual(
  expanded.map((t) => hasOperationalTimer(t)),
  [true, true, true, true, false, false, false],
  "OS expandida: sessao/captacao SIM, beat/mix/master NÃO"
);

const mixApt: Agendamento = {
  id: 1,
  data: "2026-10-01T15:00:00.000Z",
  duracaoMinutos: 60,
  tipo: "mix",
  status: "aceito",
  pagamento: null,
};
const mixTl = buildOrderTimeline(mixApt);
const mixDesc = String(mixTl.find((i) => i.key === "agendamento")?.description ?? "");
assert.equal(mixDesc.includes("min"), false, "portal Mix não anexa N min");
assert.equal(mixDesc.includes("Mix"), true);

const sessaoApt: Agendamento = { ...mixApt, tipo: "sessao" };
const sessaoDesc = String(
  buildOrderTimeline(sessaoApt).find((i) => i.key === "agendamento")?.description ?? ""
);
assert.match(sessaoDesc, /60 min/);

console.log("[admin-operational-slot-chrome-smoke] PASS");
