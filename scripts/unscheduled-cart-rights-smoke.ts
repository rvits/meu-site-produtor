/**
 * Carrinho pago sem data/hora → direitos GO-H5 (Coupon + ServiceOrder), sem Appointment inventado.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  exigeAgendamentoNoCheckout,
  isCouponsOnlyAgendamentoPayment,
} from "../src/app/lib/agendamento-payment-rules";
import { expandPurchaseToServiceOrders } from "../src/app/lib/service-orders";
import { planConfirmedAsaasPaymentRecovery } from "../src/app/lib/recover-confirmed-asaas-payment";
import { CHECKOUT_CATALOG, totalPricedCheckoutItems, priceCheckoutItems } from "../src/app/lib/service-catalog";

function pass(label: string) {
  console.log("PASS", label);
}

function rights(services: Array<{ id: string; quantidade: number }>, beats: Array<{ id: string; quantidade: number }> = []) {
  return expandPurchaseToServiceOrders(services, beats).map((o) => o.serviceType);
}

type Mode = "appointment-services" | "pending-rights";

function mode(s: Array<{ id: string; quantidade: number }>, b: Array<{ id: string; quantidade: number }> = []): Mode {
  return isCouponsOnlyAgendamentoPayment({}, s, b) || !exigeAgendamentoNoCheckout(s, b)
    ? "pending-rights"
    : "appointment-services";
}

const matrix: Array<{
  id: string;
  s: Array<{ id: string; quantidade: number }>;
  b: Array<{ id: string; quantidade: number }>;
  expected: string[];
  expectedMode: Mode;
}> = [
  { id: "A sessao×1", s: [{ id: "sessao", quantidade: 1 }], b: [], expected: ["sessao"], expectedMode: "appointment-services" },
  { id: "B captacao×1", s: [{ id: "captacao", quantidade: 1 }], b: [], expected: ["captacao"], expectedMode: "appointment-services" },
  { id: "C mix×1", s: [{ id: "mix", quantidade: 1 }], b: [], expected: ["mix"], expectedMode: "appointment-services" },
  { id: "D captacao+mix", s: [{ id: "captacao", quantidade: 1 }, { id: "mix", quantidade: 1 }], b: [], expected: ["captacao", "mix"], expectedMode: "pending-rights" },
  {
    id: "E captacao+mix_master",
    s: [{ id: "captacao", quantidade: 1 }, { id: "mix_master", quantidade: 1 }],
    b: [],
    expected: ["captacao", "mix", "master"],
    expectedMode: "pending-rights",
  },
  { id: "F mix_master", s: [{ id: "mix_master", quantidade: 1 }], b: [], expected: ["mix", "master"], expectedMode: "pending-rights" },
  { id: "G 2 Beats", s: [], b: [{ id: "beat2", quantidade: 1 }], expected: ["beat1", "beat1"], expectedMode: "pending-rights" },
  { id: "H 4 Beats", s: [], b: [{ id: "beat4", quantidade: 1 }], expected: ["beat1", "beat1", "beat1", "beat1"], expectedMode: "pending-rights" },
  {
    id: "I Beat+Mix+Master",
    s: [],
    b: [{ id: "beat_mix_master", quantidade: 1 }],
    expected: ["beat1", "mix", "master"],
    expectedMode: "pending-rights",
  },
  {
    id: "J Produção Completa",
    s: [],
    b: [{ id: "producao_completa", quantidade: 1 }],
    expected: ["sessao", "sessao", "captacao", "captacao", "beat1", "mix", "master"],
    expectedMode: "pending-rights",
  },
];

for (const row of matrix) {
  assert.deepEqual(rights(row.s, row.b), row.expected);
  assert.equal(mode(row.s, row.b), row.expectedMode, row.id);
  pass(`${row.id} → ${row.expected.join("+")} (${row.expectedMode})`);
}

{
  const priced = priceCheckoutItems(
    [
      { id: "captacao", quantidade: 1 },
      { id: "mix_master", quantidade: 1 },
    ],
    "service"
  );
  assert.equal(totalPricedCheckoutItems(priced), 225);
  assert.equal(CHECKOUT_CATALOG.mix_master.preco, 170);
}

const op = "025eb001-0d66-4dd2-a14f-ead9b70de0fc";
const asaasId = "pay_iq3u34pe0wiq7s6n";
const unscheduledMeta = {
  tipo: "carrinho",
  paymentMethod: "cartao_credito",
  total: "225",
  discount: 0,
  items: JSON.stringify([
    {
      tipo: "sessao",
      duracaoMinutos: 60,
      servicos: [
        { id: "captacao", quantidade: 1, preco: 55 },
        { id: "mix_master", quantidade: 1, preco: 170 },
      ],
      beats: [],
      subtotal: 225,
      discount: 0,
      total: 225,
    },
  ]),
};

{
  const first = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: unscheduledMeta,
    storedAsaasId: asaasId,
    existingPaymentId: null,
  });
  const second = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: unscheduledMeta,
    storedAsaasId: asaasId,
    existingPaymentId: "pay-db-1",
  });
  assert.equal(first.ok, true);
  assert.equal(first.materialization, "pending-rights");
  assert.equal(first.appointmentCount, 0);
  assert.equal(first.serviceCount, 0);
  assert.equal(first.couponOps, 3);
  assert.equal(first.serviceOrderOps, 3);
  assert.deepEqual(first.serviceTipos, ["captacao", "mix", "master"]);
  assert.equal(first.expectedAmount, 225);
  assert.equal(first.action, "create");
  assert.equal(second.action, "reconcile");
  assert.equal(second.couponOps, 3);
  pass("caso real R$225 sem agenda: 3 cupons/ordens; replay reconcilia");
}

{
  const src = fs.readFileSync(
    path.join(__dirname, "../src/app/lib/asaas-carrinho-payment-effects.ts"),
    "utf8"
  );
  assert.match(src, /createCouponsForAgendamentoItems/);
  assert.match(src, /hasImmediateSchedule/);
  assert.doesNotMatch(src, /22:00/);
  pass("pipeline de carrinho reutiliza GO-H5; não inventa horário");
}

console.log(JSON.stringify({ reportId: "unscheduled-cart-rights-smoke", pass: true }, null, 2));
