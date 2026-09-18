/**
 * GO-H5 no carrinho: SKU composto → direitos atômicos. Preço comercial intacto.
 * Sem banco, sem Asaas, sem produção.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";
import {
  CHECKOUT_CATALOG,
  priceCheckoutItems,
  totalPricedCheckoutItems,
} from "../src/app/lib/service-catalog";
import {
  COMMERCIAL_PRODUCT_COMPOSITION,
  expandPurchaseToAtomicServiceLines,
  expandPurchaseToServiceOrders,
  resolveServiceExecutionMaterialization,
} from "../src/app/lib/service-orders";
import { expectedServiceLines } from "../src/app/lib/asaas-agendamento-payment-effects";
import { planConfirmedAsaasPaymentRecovery } from "../src/app/lib/recover-confirmed-asaas-payment";
import { decideOperationalAsaasWebhookAction } from "../src/app/lib/asaas-approved-payment-event";
import { missingServiceCount } from "../src/app/lib/payment-appointment-idempotency";
import { hasOperationalTimer, resolveOperationalStartWrite } from "../src/app/lib/service-timing";
import { serviceOrderLabel } from "../src/app/lib/ui/service-order-visual";

function pass(label: string) {
  console.log("PASS", label);
}

assert.deepEqual(COMMERCIAL_PRODUCT_COMPOSITION.mix_master, ["mix", "master"]);

{
  const lines = expandPurchaseToAtomicServiceLines([{ id: "captacao", quantidade: 1 }], []);
  assert.deepEqual(lines, [{ id: "captacao", quantidade: 1 }]);
  assert.equal(expectedServiceLines([{ id: "captacao", quantidade: 1 }], []), 1);
  pass("CASO 1 captacao ×1 → 1 direito captacao");
}

{
  const tipos = expandPurchaseToServiceOrders([{ id: "mix_master", quantidade: 1 }], []).map(
    (o) => o.serviceType
  );
  assert.deepEqual(tipos, ["mix", "master"]);
  assert.equal(expectedServiceLines([{ id: "mix_master", quantidade: 1 }], []), 2);
  pass("CASO 2 mix_master ×1 → mix ×1 + master ×1");
}

{
  const services = [
    { id: "captacao", quantidade: 1 },
    { id: "mix_master", quantidade: 1 },
  ];
  const tipos = expandPurchaseToServiceOrders(services, []).map((o) => o.serviceType);
  assert.deepEqual(tipos, ["captacao", "mix", "master"]);
  assert.equal(expectedServiceLines(services, []), 3);
  const mat = resolveServiceExecutionMaterialization({ services, beats: [], existingTipos: [] });
  assert.equal(mat.mode, "atomic");
  assert.equal(mat.expectedCount, 3);
  assert.deepEqual(
    mat.services.map((s) => s.id),
    ["captacao", "mix", "master"]
  );
  pass("CASO 3 captacao ×1 + mix_master ×1 → 3 direitos atômicos");
}

{
  const tipos = expandPurchaseToServiceOrders([{ id: "mix_master", quantidade: 2 }], []).map(
    (o) => o.serviceType
  );
  assert.deepEqual(tipos, ["mix", "master", "mix", "master"]);
  const grouped = expandPurchaseToAtomicServiceLines([{ id: "mix_master", quantidade: 2 }], []);
  assert.deepEqual(grouped, [
    { id: "mix", quantidade: 2 },
    { id: "master", quantidade: 2 },
  ]);
  assert.equal(expectedServiceLines([{ id: "mix_master", quantidade: 2 }], []), 4);
  pass("CASO 4 mix_master ×2 → mix ×2 + master ×2");
}

const cartMeta = {
  tipo: "carrinho",
  paymentMethod: "cartao_credito",
  total: "225",
  discount: 0,
  items: JSON.stringify([
    {
      data: "2026-09-25",
      hora: "14:00",
      duracaoMinutos: 60,
      tipo: "sessao",
      servicos: [
        { id: "captacao", quantidade: 1, preco: 55 },
        { id: "mix_master", quantidade: 1, preco: 170 },
      ],
      beats: [],
      discount: 0,
    },
  ]),
};

{
  const first = planConfirmedAsaasPaymentRecovery({
    operationId: "025eb001-0d66-4dd2-a14f-ead9b70de0fc",
    expectedAsaasId: "pay_iq3u34pe0wiq7s6n",
    expectedAmount: 225,
    metadata: cartMeta,
    storedAsaasId: "pay_iq3u34pe0wiq7s6n",
    existingPaymentId: null,
  });
  const second = planConfirmedAsaasPaymentRecovery({
    operationId: "025eb001-0d66-4dd2-a14f-ead9b70de0fc",
    expectedAsaasId: "pay_iq3u34pe0wiq7s6n",
    expectedAmount: 225,
    metadata: cartMeta,
    storedAsaasId: "pay_iq3u34pe0wiq7s6n",
    existingPaymentId: "pay-db-1",
  });
  assert.equal(first.action, "create");
  assert.equal(second.action, "reconcile");
  assert.equal(first.serviceCount, 3);
  assert.equal(second.serviceCount, 3);
  assert.equal(first.appointmentCount, 1);
  assert.equal(second.appointmentCount, 1);
  assert.equal(missingServiceCount(3, 3), 0);
  pass("CASO 5 replay do mesmo pagamento → reconcile, expected 3, zero duplicação planejada");
}

{
  const after = decideOperationalAsaasWebhookAction({
    event: "PAYMENT_RECEIVED",
    status: "RECEIVED",
    existingPaymentId: "pay-db-1",
  });
  assert.equal(after, "reconcile");
  pass("CASO 6 PAYMENT_CONFIRMED + PAYMENT_RECEIVED → reconcile");
}

{
  assert.equal(CHECKOUT_CATALOG.mix_master.preco, 170);
  assert.equal(CHECKOUT_CATALOG.mix.preco, 110);
  assert.equal(CHECKOUT_CATALOG.master.preco, 80);
  assert.notEqual(CHECKOUT_CATALOG.mix.preco + CHECKOUT_CATALOG.master.preco, 170);
  const priced = priceCheckoutItems(
    [{ id: "mix_master", quantidade: 1 }],
    "service"
  );
  assert.equal(totalPricedCheckoutItems(priced), 170);
  pass("CASO 7 mix_master permanece R$170; não vira R$190");
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
  const plan = planConfirmedAsaasPaymentRecovery({
    operationId: "025eb001-0d66-4dd2-a14f-ead9b70de0fc",
    expectedAsaasId: "pay_iq3u34pe0wiq7s6n",
    expectedAmount: 225,
    metadata: cartMeta,
    storedAsaasId: "pay_iq3u34pe0wiq7s6n",
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.expectedAmount, 225);
  assert.deepEqual(plan.serviceTipos, ["captacao", "mix", "master"]);
  assert.equal(plan.couponOps, 0);
  pass("CASO 8 Payment esperado 225; direitos captacao + mix + master");
}

{
  const legacy = resolveServiceExecutionMaterialization({
    services: [
      { id: "captacao", quantidade: 1 },
      { id: "mix_master", quantidade: 1 },
    ],
    beats: [],
    existingTipos: ["captacao", "mix_master"],
  });
  assert.equal(legacy.mode, "legacy-composite");
  assert.equal(legacy.expectedCount, 2);
  assert.deepEqual(
    legacy.services.map((s) => s.id),
    ["captacao", "mix_master"]
  );
  assert.equal(serviceOrderLabel("mix_master"), "Mixagem");
  pass("CASO 9 legacy Service.tipo=mix_master permanece legível e não é convertido");
}

{
  const withPromo = planConfirmedAsaasPaymentRecovery({
    operationId: "025eb001-0d66-4dd2-a14f-ead9b70de0fc",
    expectedAsaasId: "pay_iq3u34pe0wiq7s6n",
    expectedAmount: 225,
    metadata: {
      ...cartMeta,
      discount: 0,
      items: JSON.stringify([
        {
          data: "2026-09-25",
          hora: "14:00",
          duracaoMinutos: 60,
          tipo: "sessao",
          servicos: [
            { id: "captacao", quantidade: 1, preco: 55 },
            { id: "mix_master", quantidade: 1, preco: 170 },
          ],
          beats: [],
          discount: 0,
        },
      ]),
    },
    storedAsaasId: "pay_iq3u34pe0wiq7s6n",
  });
  assert.equal(withPromo.couponOps, 0);
  assert.equal(withPromo.expectedAmount, 225);
  pass("CASO 10 sem cupom promocional: 0 usos; total comercial 225");
}

{
  assert.equal(hasOperationalTimer("captacao"), true);
  assert.equal(hasOperationalTimer("mix"), false);
  assert.equal(hasOperationalTimer("master"), false);
  assert.equal(
    resolveOperationalStartWrite({
      tipo: "mix",
      existingStartedAt: null,
      now: new Date(),
    }),
    null
  );
  pass("timer: captacao inalterado; mix/master sem startedAt no pagamento");
}

{
  const factory = fs.readFileSync(
    path.join(__dirname, "../src/app/lib/asaas-agendamento-payment-effects.ts"),
    "utf8"
  );
  const carrinho = fs.readFileSync(
    path.join(__dirname, "../src/app/lib/asaas-carrinho-payment-effects.ts"),
    "utf8"
  );
  assert.match(factory, /resolveServiceExecutionMaterialization/);
  assert.match(carrinho, /createServicesForAppointmentIfMissing/);
  assert.doesNotMatch(carrinho, /if \(id === ["']mix_master["']\)/);
  pass("fonte única: factory usa composição GO-H5; carrinho sem if mix_master");
}

console.log(JSON.stringify({ reportId: "commercial-composition-cart-smoke", pass: true }, null, 2));
