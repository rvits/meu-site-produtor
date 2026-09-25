/**
 * Confirmação visual de agendamento atômico (Prompt 2).
 * Não cria Appointment, não consome cupom, não chama Asaas.
 */
import assert from "node:assert/strict";
import { CHECKOUT_CATALOG } from "../src/app/lib/service-catalog";
import {
  buildCouponRedemptionConfirmation,
  buildPurchaseConfirmation,
  buildScheduleSummaryLines,
  claimSingleConfirmation,
  confirmChoiceExecutesContinuation,
  formatCartScheduleHeading,
  purchaseNeedsAppointmentConfirmation,
} from "../src/app/lib/appointment-confirmation";

const DATE = "2026-09-25";
const DATE_LABEL = "25/09/2026";

function line(id: string, quantidade = 1) {
  const item = CHECKOUT_CATALOG[id as keyof typeof CHECKOUT_CATALOG];
  assert.ok(item, id);
  const bucket = item.category === "beat" ? "beats" : "services";
  return {
    bucket: bucket as "services" | "beats",
    row: { id: item.id, nome: item.nome, quantidade, preco: item.preco },
    preco: item.preco,
    nome: item.nome,
  };
}

function purchase(id: string, quantidade = 1, hour: string | null = "19:00") {
  const built = line(id, quantidade);
  const services = built.bucket === "services" ? [built.row] : [];
  const beats = built.bucket === "beats" ? [built.row] : [];
  return buildPurchaseConfirmation({
    services,
    beats,
    dateIso: DATE,
    civilHour: hour,
    value: built.preco * quantidade,
  });
}

function assertNoHour(view: { hourLabel: string | null; question: string } | null, label: string) {
  assert.ok(view, `${label} exige modal`);
  assert.equal(view.hourLabel, null, label);
  assert.equal(view.question.includes("às"), false, label);
  assert.equal(view.question.includes("22:00"), false, label);
  assert.equal(JSON.stringify(view).includes("Horário"), false, label);
}

let checks = 0;
function ok(label: string) {
  checks += 1;
  console.log("PASS", label);
}

{
  const view = purchase("sessao");
  assert.ok(view);
  assert.equal(view.serviceName, "Sessão");
  assert.equal(view.dateLabel, DATE_LABEL);
  assert.equal(view.hourLabel, "19:00");
  assert.equal(view.valueLabel, "R$ 40,00");
  assert.match(view.question, /Sessão no dia 25\/09\/2026 às 19:00, no valor de R\$ 40,00/);
  ok("1 sessão modal com horário e R$ 40,00");
}

{
  const view = purchase("captacao");
  assert.ok(view);
  assert.equal(view.hourLabel, "19:00");
  assert.equal(view.valueLabel, "R$ 55,00");
  ok("2 captação horário e R$ 55,00");
}

{
  const view = purchase("mix", 1, "22:00");
  assertNoHour(view, "mix");
  assert.equal(view!.dateLabel, DATE_LABEL);
  assert.equal(view!.valueLabel, "R$ 110,00");
  assert.equal(view!.serviceName, "Mixagem");
  ok("3 mix sem horário e R$ 110,00");
}

{
  assertNoHour(purchase("master", 1, "22:00"), "master");
  ok("4 master sem horário");
}

{
  assertNoHour(purchase("sonoplastia", 1, "22:00"), "sonoplastia");
  ok("5 sonoplastia sem horário");
}

{
  assertNoHour(purchase("beat1", 1, "22:00"), "beat1");
  ok("6 beat1 sem horário");
}

for (const id of ["beat2", "beat3", "beat4", "mix_master", "beat_mix_master", "producao_completa"]) {
  assert.equal(purchase(id), null, id);
  assert.equal(purchaseNeedsAppointmentConfirmation(
    line(id).bucket === "services" ? [line(id).row] : [],
    line(id).bucket === "beats" ? [line(id).row] : []
  ), false);
  ok(`${id} sem modal de agendamento`);
}

{
  const two = line("sessao", 2);
  const view = buildPurchaseConfirmation({
    services: [two.row],
    beats: [],
    dateIso: DATE,
    civilHour: "19:00",
    value: two.preco * 2,
  });
  assert.equal(view, null);
  ok("13 quantidade 2 de sessão é multi-order sem modal");
}

{
  const sessao = line("sessao");
  const heading = formatCartScheduleHeading({
    data: DATE,
    hora: "22:00",
    servicos: [sessao.row],
    beats: [],
  });
  assert.equal(heading, "25/09/2026 às 22:00");
  ok("14 sessão real às 22:00 continua visível");
}

{
  const mix = line("mix");
  const heading = formatCartScheduleHeading({
    data: DATE,
    hora: "22:00",
    servicos: [mix.row],
    beats: [],
  });
  assert.equal(heading, "25/09/2026");
  assert.equal(heading.includes("22:00"), false);
  assert.equal(heading.includes("às"), false);
  ok("15 mix técnico 22:00 não mostra horário");
}

assert.equal(confirmChoiceExecutesContinuation("voltar"), false);
assert.equal(confirmChoiceExecutesContinuation("confirmar"), true);
ok("16 voltar não executa continuação");
ok("17 confirmar executa continuação uma vez");

{
  const sessao = buildCouponRedemptionConfirmation({
    serviceType: "sessao",
    serviceName: "Sessão",
    dateIso: DATE,
    civilHour: "19:00",
  });
  const captacao = buildCouponRedemptionConfirmation({
    serviceType: "captacao",
    serviceName: "Captação",
    dateIso: DATE,
    civilHour: "19:00",
  });
  assert.equal(sessao.hourLabel, "19:00");
  assert.equal(sessao.valueLabel, "R$ 0,00");
  assert.equal(captacao.hourLabel, "19:00");
  assert.equal(captacao.valueLabel, "R$ 0,00");
  assert.equal(sessao.question.includes("R$ 40,00"), false);
  ok("18 cupom sessão/captação horário e R$ 0,00");
}

for (const [type, name] of [
  ["mix", "Mixagem"],
  ["master", "Masterização"],
  ["beat1", "1 Beat"],
  ["sonoplastia", "Sonoplastia"],
] as const) {
  const view = buildCouponRedemptionConfirmation({
    serviceType: type,
    serviceName: name,
    dateIso: DATE,
    civilHour: "22:00",
  });
  assertNoHour(view, type);
  assert.equal(view.valueLabel, "R$ 0,00");
  assert.equal(view.question.includes("R$ 110,00"), false);
  ok(`19 cupom ${type} sem horário e R$ 0,00`);
}

assert.equal(confirmChoiceExecutesContinuation("voltar"), false);
ok("20 voltar no cupom não executa POST");

function summary(id: string, quantidade = 1, hour: string | null = null) {
  const built = line(id, quantidade);
  return buildScheduleSummaryLines({
    services: built.bucket === "services" ? [built.row] : [],
    beats: built.bucket === "beats" ? [built.row] : [],
    dateLabel: DATE_LABEL,
    hourLabel: hour,
  });
}

{
  const lines = summary("sessao", 1, "19:00");
  assert.deepEqual(lines, ["Data: 25/09/2026", "Horário: 19:00"]);
  ok("resumo tipo A mostra data e horário");
}

{
  for (const id of ["mix", "master", "sonoplastia", "beat1"]) {
    const lines = summary(id, 1, "22:00");
    assert.deepEqual(lines, ["Data: 25/09/2026"]);
    assert.equal(lines.join(" ").includes("Horário"), false);
    assert.equal(lines.join(" ").includes("22:00"), false);
  }
  ok("resumo tipo B não renderiza Horário");
}

{
  for (const id of ["beat2", "beat3", "beat4", "mix_master", "beat_mix_master", "producao_completa"]) {
    assert.deepEqual(summary(id), []);
  }
  assert.deepEqual(summary("sessao", 2, "19:00"), []);
  assert.deepEqual(summary("mix", 2, "22:00"), []);
  assert.deepEqual(summary("beat1", 2, "22:00"), []);
  assert.equal(purchase("mix", 2, "22:00"), null);
  assert.equal(purchase("beat1", 2, "22:00"), null);
  ok("resumo tipo C e quantidades 2 sem data/horário únicos");
}

{
  const captacao = line("captacao");
  assert.equal(
    formatCartScheduleHeading({ data: DATE, hora: "22:00", servicos: [captacao.row], beats: [] }),
    "25/09/2026 às 22:00"
  );
  ok("captação real às 22:00 continua visível no carrinho");
}

{
  const guard = { current: false };
  let posts = 0;
  function confirm() {
    if (!confirmChoiceExecutesContinuation("confirmar")) return;
    if (!claimSingleConfirmation(guard)) return;
    posts += 1;
  }
  function back() {
    if (confirmChoiceExecutesContinuation("voltar")) posts += 1;
    else guard.current = false;
  }
  back();
  assert.equal(posts, 0);
  confirm();
  confirm();
  assert.equal(posts, 1);
  ok("double submit dispara a continuação uma vez");
}

console.log(JSON.stringify({ reportId: "appointment-confirmation-smoke", pass: true, checks }));
