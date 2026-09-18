/**
 * Matriz global: SKU comercial, preço, direitos, modo de agenda, planos.
 */
import assert from "node:assert/strict";
import { CHECKOUT_CATALOG } from "../src/app/lib/service-catalog";
import {
  COMMERCIAL_PRODUCT_COMPOSITION,
  expandPurchaseToServiceOrders,
  countServiceOrders,
} from "../src/app/lib/service-orders";
import {
  exigeAgendamentoHora,
  exigeAgendamentoSomenteData,
  isCouponsOnlyAgendamentoPayment,
} from "../src/app/lib/agendamento-payment-rules";
import {
  PLAN_DEFINITIONS,
  countPlanCycleCoupons,
  summarizePlanCycleCoupons,
} from "../src/app/lib/plan-definitions";
import { expectedServiceLines } from "../src/app/lib/asaas-agendamento-payment-effects";
import { SCHEDULING_COPY } from "../src/app/lib/scheduling-context";

function pass(label: string) {
  console.log("PASS", label);
}

type Mode = "hora" | "data" | "cupons";

function modeFor(services: Array<{ id: string; quantidade: number }>, beats: Array<{ id: string; quantidade: number }>): Mode {
  if (isCouponsOnlyAgendamentoPayment({}, services, beats)) return "cupons";
  if (exigeAgendamentoHora(services, beats)) return "hora";
  if (exigeAgendamentoSomenteData(services, beats)) return "data";
  return "cupons";
}

const rows: Array<{
  sku: string;
  preco: number;
  rights: string[];
  mode: Mode;
}> = [
  { sku: "sessao", preco: 40, rights: ["sessao"], mode: "hora" },
  { sku: "captacao", preco: 55, rights: ["captacao"], mode: "hora" },
  { sku: "mix", preco: 110, rights: ["mix"], mode: "data" },
  { sku: "master", preco: 80, rights: ["master"], mode: "data" },
  { sku: "mix_master", preco: 170, rights: ["mix", "master"], mode: "cupons" },
  { sku: "sonoplastia", preco: 350, rights: ["sonoplastia"], mode: "data" },
  { sku: "beat1", preco: 150, rights: ["beat1"], mode: "data" },
  { sku: "beat2", preco: 250, rights: ["beat1", "beat1"], mode: "cupons" },
  { sku: "beat3", preco: 350, rights: ["beat1", "beat1", "beat1"], mode: "cupons" },
  { sku: "beat4", preco: 400, rights: ["beat1", "beat1", "beat1", "beat1"], mode: "cupons" },
  { sku: "beat_mix_master", preco: 320, rights: ["beat1", "mix", "master"], mode: "cupons" },
  {
    sku: "producao_completa",
    preco: 450,
    rights: ["sessao", "sessao", "captacao", "captacao", "beat1", "mix", "master"],
    mode: "cupons",
  },
];

console.log("SKU | preço | direitos | modo | coupons | services(cart atomic)");
for (const row of rows) {
  assert.equal(CHECKOUT_CATALOG[row.sku as keyof typeof CHECKOUT_CATALOG].preco, row.preco);
  const isBeat = CHECKOUT_CATALOG[row.sku as keyof typeof CHECKOUT_CATALOG].category === "beat";
  const services = isBeat ? [] : [{ id: row.sku, quantidade: 1 }];
  const beats = isBeat ? [{ id: row.sku, quantidade: 1 }] : [];
  const rights = expandPurchaseToServiceOrders(services, beats).map((o) => o.serviceType);
  assert.deepEqual(rights, row.rights);
  assert.equal(modeFor(services, beats), row.mode);
  const couponCount = row.mode === "cupons" ? rights.length : 0;
  const serviceWhenScheduled = row.mode === "cupons" ? 0 : expectedServiceLines(services, beats);
  console.log(
    `${row.sku} | ${row.preco} | ${rights.join("+")} | ${row.mode} | coupons=${couponCount} | svc=${serviceWhenScheduled}`
  );
}

assert.deepEqual(COMMERCIAL_PRODUCT_COMPOSITION.mix_master, ["mix", "master"]);
assert.equal(countServiceOrders([{ id: "mix_master", quantidade: 1 }], []), 2);
assert.equal(
  expectedServiceLines(
    [{ id: "captacao", quantidade: 1 }, { id: "mix_master", quantidade: 1 }],
    []
  ),
  3
);
pass("catálogo + composição + modos de agenda");

assert.equal(CHECKOUT_CATALOG.mix_master.preco, 170);
assert.notEqual(CHECKOUT_CATALOG.mix.preco + CHECKOUT_CATALOG.master.preco, 170);
pass("preço comercial de pacote não é soma avulsa");

const bronze = summarizePlanCycleCoupons("bronze")!;
assert.equal(bronze.sessao, 1);
assert.equal(bronze.captacao, 2);
assert.equal(bronze.mix, 1);
assert.equal(bronze.serviceDiscount, 1);
assert.equal(bronze.serviceCoupons, 4);
assert.equal(bronze.discountCoupons, 1);
assert.equal(bronze.totalCoupons, 5);
assert.equal(countPlanCycleCoupons("bronze"), 5);
pass("Bronze 4 serviço + 1 desconto = 5");

const prata = summarizePlanCycleCoupons("prata")!;
assert.equal(prata.sessao, 1);
assert.equal(prata.captacao, 2);
assert.equal(prata.mix, 1);
assert.equal(prata.master, 1);
assert.equal(prata.beat, 1);
assert.equal(prata.serviceCoupons, 6);
assert.equal(prata.discountCoupons, 0);
assert.equal(prata.totalCoupons, 6);
pass("Prata 6 cupons de serviço");

const ouro = summarizePlanCycleCoupons("ouro")!;
assert.equal(ouro.sessao, 2);
assert.equal(ouro.captacao, 4);
assert.equal(ouro.mix, 2);
assert.equal(ouro.master, 2);
assert.equal(ouro.beat, 2);
assert.equal(ouro.serviceDiscount, 1);
assert.equal(ouro.beatDiscount, 1);
assert.equal(ouro.serviceCoupons, 12);
assert.equal(ouro.discountCoupons, 2);
assert.equal(ouro.totalCoupons, 14);
assert.equal(countPlanCycleCoupons("ouro"), 14);
assert.notEqual(ouro.totalCoupons, 28);
pass("Ouro exatamente 14 cupons");

assert.equal(PLAN_DEFINITIONS.bronze.mensal, 239.99);
assert.equal(PLAN_DEFINITIONS.prata.mensal, 449.99);
assert.equal(PLAN_DEFINITIONS.ouro.mensal, 799.99);

assert.match(SCHEDULING_COPY.presencial, /data e o horário/);
assert.match(SCHEDULING_COPY.producao, /prazo de entrega desejado/);
assert.match(SCHEDULING_COPY.multiplosDireitos, /direitos independentes/);

console.log(JSON.stringify({ reportId: "domain-catalog-matrix-smoke", pass: true }, null, 2));
