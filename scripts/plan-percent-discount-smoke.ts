/**
 * Cupons percentuais de plano: 10% serviços (subtotal elegível) vs 10% beats (1 unidade, maior SKU).
 */
import assert from "node:assert/strict";
import {
  computePlanPercentDiscount,
  PERCENT_BEATS_ELIGIBLE_SKUS,
  PERCENT_SERVICOS_ELIGIBLE_SKUS,
} from "../src/app/lib/plan-percent-discount";
import { CHECKOUT_CATALOG } from "../src/app/lib/service-catalog";
import { expandPurchaseToServiceOrders } from "../src/app/lib/service-orders";
import { decideCouponFulfillmentOp } from "../src/app/lib/payment-appointment-idempotency";

function pass(label: string) {
  console.log("PASS", label);
}

function servicosPct(services: Array<{ id: string; quantidade: number }>, beats: Array<{ id: string; quantidade: number }> = []) {
  return computePlanPercentDiscount({
    serviceType: "percent_servicos",
    percent: 10,
    services,
    beats,
  });
}

function beatsPct(beats: Array<{ id: string; quantidade: number }>, services: Array<{ id: string; quantidade: number }> = []) {
  return computePlanPercentDiscount({
    serviceType: "percent_beats",
    percent: 10,
    services,
    beats,
  });
}

assert.deepEqual([...PERCENT_SERVICOS_ELIGIBLE_SKUS], [
  "sessao",
  "captacao",
  "mix",
  "master",
  "mix_master",
  "sonoplastia",
]);
assert.deepEqual([...PERCENT_BEATS_ELIGIBLE_SKUS], ["beat1", "beat2", "beat3", "beat4"]);

{
  const one = servicosPct([{ id: "sessao", quantidade: 1 }]);
  assert.equal(one.ok, true);
  if (one.ok) {
    assert.equal(one.base, 40);
    assert.equal(one.discount, 4);
  }
  pass("serviços: 1 elegível → 10% daquele serviço");
}

{
  const two = servicosPct([
    { id: "sessao", quantidade: 1 },
    { id: "captacao", quantidade: 1 },
  ]);
  assert.equal(two.ok, true);
  if (two.ok) {
    assert.equal(two.base, 95);
    assert.equal(two.discount, 9.5);
  }
  pass("serviços: 2 elegíveis → 10% da soma (R$9,50)");
}

{
  const three = servicosPct([
    { id: "sessao", quantidade: 1 },
    { id: "captacao", quantidade: 1 },
    { id: "mix", quantidade: 1 },
  ]);
  assert.equal(three.ok, true);
  if (three.ok) {
    assert.equal(three.base, 205);
    assert.equal(three.discount, 20.5);
  }
  pass("serviços: 3 elegíveis → 10% da soma");
}

{
  const qty2 = servicosPct([{ id: "sessao", quantidade: 2 }]);
  assert.equal(qty2.ok, true);
  if (qty2.ok) {
    assert.equal(qty2.base, 80);
    assert.equal(qty2.discount, 8);
  }
  pass("serviços: quantidade 2 entra no subtotal");
}

{
  const mixed = servicosPct([{ id: "sessao", quantidade: 1 }], [{ id: "beat1", quantidade: 1 }]);
  assert.equal(mixed.ok, true);
  if (mixed.ok) {
    assert.equal(mixed.base, 40);
    assert.equal(mixed.discount, 4);
  }
  pass("serviços: item não elegível (beat) fora da base");
}

{
  const none = servicosPct([], [{ id: "beat1", quantidade: 1 }]);
  assert.equal(none.ok, false);
  pass("serviços: nenhum elegível → rejeita");
}

{
  const cases: Array<[string, number, number]> = [
    ["beat1", 15, 150],
    ["beat2", 25, 250],
    ["beat3", 35, 350],
    ["beat4", 40, 400],
  ];
  for (const [id, discount, base] of cases) {
    const r = beatsPct([{ id, quantidade: 1 }]);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.discount, discount);
      assert.equal(r.base, base);
    }
  }
  pass("beats: 1/2/3/4 Beats ×1 → R$15/25/35/40");
}

{
  const r = beatsPct([{ id: "beat1", quantidade: 2 }]);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.discount, 15);
    assert.equal(r.base, 150);
  }
  pass("beats: 1 Beat ×2 → desconto só R$15");
}

{
  const r = beatsPct([{ id: "beat2", quantidade: 2 }]);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.discount, 25);
  pass("beats: 2 Beats ×2 → R$25");
}

{
  const r = beatsPct([{ id: "beat4", quantidade: 2 }]);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.discount, 40);
  pass("beats: 4 Beats ×2 empate → uma unidade R$40");
}

{
  const r = beatsPct([
    { id: "beat1", quantidade: 1 },
    { id: "beat2", quantidade: 1 },
  ]);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.chosenSku, "beat2");
    assert.equal(r.discount, 25);
  }
  pass("beats: 1+2 → escolhe 2 Beats R$25");
}

{
  const r = beatsPct([
    { id: "beat1", quantidade: 1 },
    { id: "beat4", quantidade: 1 },
  ]);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.chosenSku, "beat4");
    assert.equal(r.discount, 40);
  }
  pass("beats: 1+4 → R$40; total comercial 550, não 10% de 550");
}

{
  const r = beatsPct([
    { id: "beat2", quantidade: 1 },
    { id: "beat4", quantidade: 1 },
  ]);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.discount, 40);
    const rights = expandPurchaseToServiceOrders(
      [],
      [
        { id: "beat2", quantidade: 1 },
        { id: "beat4", quantidade: 1 },
      ]
    );
    assert.equal(rights.length, 6);
  }
  pass("beats: 2+4 → desconto R$40 e 6 direitos beat intactos");
}

{
  const r = beatsPct([
    { id: "beat1", quantidade: 1 },
    { id: "beat2", quantidade: 1 },
    { id: "beat3", quantidade: 1 },
    { id: "beat4", quantidade: 1 },
  ]);
  assert.equal(r.ok, true);
  if (r.ok) {
    assert.equal(r.chosenSku, "beat4");
    assert.equal(r.discount, 40);
  }
  pass("beats: 1+2+3+4 → escolhe 4 Beats R$40");
}

const rejectIds = [
  "sessao",
  "captacao",
  "mix",
  "master",
  "mix_master",
  "sonoplastia",
  "beat_mix_master",
  "producao_completa",
];
for (const id of rejectIds) {
  const cat = CHECKOUT_CATALOG[id as keyof typeof CHECKOUT_CATALOG];
  const r =
    cat.category === "beat"
      ? beatsPct([{ id, quantidade: 1 }])
      : beatsPct([], [{ id, quantidade: 1 }]);
  assert.equal(r.ok, false, id);
}
pass("beats: SKUs compostos/estúdio rejeitados");

{
  const replay = decideCouponFulfillmentOp({
    hasCoupon: true,
    useCount: 1,
    used: true,
    appointmentId: 1,
    serviceId: "s",
    targetAppointmentId: 1,
    targetServiceId: "s",
  });
  assert.equal(replay, "none");
  pass("replay: cupom já usado não reaplica");
}

console.log(JSON.stringify({ reportId: "plan-percent-discount-smoke", pass: true }, null, 2));
