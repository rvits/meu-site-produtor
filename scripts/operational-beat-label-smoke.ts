/**
 * Labels operacionais atômicos vs catálogo comercial.
 * Sem Prisma, sem Payment/Asaas, sem dados pessoais.
 */
import assert from "node:assert/strict";
import { CHECKOUT_CATALOG } from "../src/app/lib/service-catalog";
import {
  COMMERCIAL_PRODUCT_COMPOSITION,
  expandPurchaseToServiceOrders,
} from "../src/app/lib/service-orders";
import {
  ATOMIC_OPERATIONAL_LABELS,
  LEGACY_COMMERCIAL_SKU_OPERATIONAL_LABELS,
  serviceOrderLabel,
} from "../src/app/lib/ui/service-order-visual";
import { hasOperationalTimer, resolveOperationalStartWrite } from "../src/app/lib/service-timing";
import { buildPurchaseConfirmation } from "../src/app/lib/appointment-confirmation";
import { isTransitionAllowed } from "../src/app/lib/domain/state-machine/guards";

let failed = 0;
function ok(label: string) {
  console.log("PASS", label);
}
function fail(label: string, err: unknown) {
  failed += 1;
  console.error("FAIL", label, err);
}

const ATOMIC_MATRIX: [string, string][] = [
  ["sessao", "Sessão"],
  ["captacao", "Captação"],
  ["mix", "Mix"],
  ["master", "Master"],
  ["beat1", "Beat"],
  ["sonoplastia", "Sonoplastia"],
];

try {
  for (const [id, label] of ATOMIC_MATRIX) {
    assert.equal(ATOMIC_OPERATIONAL_LABELS[id], label);
    assert.equal(serviceOrderLabel(id), label);
  }
  assert.equal(serviceOrderLabel("beat"), "Beat");
  ok("matriz operacional dos 6 atômicos");
} catch (e) {
  fail("matriz operacional", e);
}

try {
  assert.equal(CHECKOUT_CATALOG.beat1.nome, "1 Beat");
  assert.equal(CHECKOUT_CATALOG.beat2.nome, "2 Beats");
  assert.equal(CHECKOUT_CATALOG.beat3.nome, "3 Beats");
  assert.equal(CHECKOUT_CATALOG.beat4.nome, "4 Beats");
  assert.equal(CHECKOUT_CATALOG.mix.nome, "Mixagem");
  assert.equal(CHECKOUT_CATALOG.master.nome, "Masterização");
  assert.equal(CHECKOUT_CATALOG.mix_master.nome, "Mix + Master");
  ok("catálogo comercial intacto (Mixagem/Masterização/1 Beat/pacotes)");
} catch (e) {
  fail("catálogo comercial", e);
}

try {
  const view = buildPurchaseConfirmation({
    services: [],
    beats: [{ id: "beat1", nome: CHECKOUT_CATALOG.beat1.nome, quantidade: 1 }],
    dateIso: "2026-09-25",
    civilHour: "22:00",
    value: CHECKOUT_CATALOG.beat1.preco,
  });
  assert.ok(view);
  assert.equal(view.serviceName, "1 Beat");
  ok("confirmação de compra beat1 continua comercial 1 Beat");
} catch (e) {
  fail("confirmação comercial beat1", e);
}

try {
  assert.notEqual(serviceOrderLabel("mix"), "Sessão");
  assert.notEqual(serviceOrderLabel("mix"), "Mix + Master");
  assert.notEqual(serviceOrderLabel("mix"), CHECKOUT_CATALOG.mix.nome);
  assert.notEqual(serviceOrderLabel("master"), "Sessão");
  assert.notEqual(serviceOrderLabel("master"), "Mix + Master");
  assert.notEqual(serviceOrderLabel("master"), CHECKOUT_CATALOG.master.nome);
  assert.notEqual(serviceOrderLabel("sonoplastia"), "Sessão");
  assert.equal(serviceOrderLabel("sessao"), "Sessão");
  assert.equal(serviceOrderLabel("captacao"), "Captação");
  ok("Mix/Master/Sonoplastia/Sessão/Captação sem colisão comercial");
} catch (e) {
  fail("colisões de label", e);
}

for (const [sku, n] of [
  ["beat2", 2],
  ["beat3", 3],
  ["beat4", 4],
] as const) {
  try {
    const orders = expandPurchaseToServiceOrders([], [{ id: sku, quantidade: 1 }]);
    assert.equal(orders.length, n);
    assert.ok(orders.every((o) => o.serviceType === "beat1"));
    assert.deepEqual(
      orders.map((o) => serviceOrderLabel(o.serviceType)),
      Array.from({ length: n }, () => "Beat")
    );
    ok(`${sku} → ${n} direitos Beat`);
  } catch (e) {
    fail(sku, e);
  }
}

try {
  const orders = expandPurchaseToServiceOrders([{ id: "mix_master", quantidade: 1 }], []);
  assert.deepEqual(
    orders.map((o) => o.serviceType),
    ["mix", "master"]
  );
  assert.deepEqual(
    orders.map((o) => serviceOrderLabel(o.serviceType)),
    ["Mix", "Master"]
  );
  ok("mix_master → Mix + Master");
} catch (e) {
  fail("mix_master", e);
}

try {
  const orders = expandPurchaseToServiceOrders([], [{ id: "beat_mix_master", quantidade: 1 }]);
  assert.deepEqual(
    orders.map((o) => o.serviceType),
    ["beat1", "mix", "master"]
  );
  assert.deepEqual(
    orders.map((o) => serviceOrderLabel(o.serviceType)),
    ["Beat", "Mix", "Master"]
  );
  ok("beat_mix_master → Beat + Mix + Master");
} catch (e) {
  fail("beat_mix_master", e);
}

try {
  const expectedTypes = [...COMMERCIAL_PRODUCT_COMPOSITION.producao_completa];
  const orders = expandPurchaseToServiceOrders([], [{ id: "producao_completa", quantidade: 1 }]);
  assert.deepEqual(
    orders.map((o) => o.serviceType),
    expectedTypes
  );
  assert.deepEqual(
    orders.map((o) => serviceOrderLabel(o.serviceType)),
    expectedTypes.map((t) => serviceOrderLabel(t))
  );
  assert.deepEqual(orders.map((o) => serviceOrderLabel(o.serviceType)), [
    "Sessão",
    "Sessão",
    "Captação",
    "Captação",
    "Beat",
    "Mix",
    "Master",
  ]);
  ok("produção completa → labels operacionais de cada direito");
} catch (e) {
  fail("producao_completa", e);
}

try {
  for (const sku of ["beat2", "beat3", "beat4", "mix_master", "beat_mix_master", "producao_completa"] as const) {
    const label = serviceOrderLabel(sku);
    assert.equal(label, LEGACY_COMMERCIAL_SKU_OPERATIONAL_LABELS[sku]);
    assert.match(label, /legado/);
    assert.notEqual(label, "Beat");
    assert.notEqual(label, "Mix");
    assert.notEqual(label, "Master");
    assert.notEqual(label, "Sessão");
  }
  ok("SKU composto em contexto operacional não colapsa ao primeiro direito");
} catch (e) {
  fail("legado composto", e);
}

try {
  assert.equal(isTransitionAllowed("appointment", "aceito", "em_andamento"), true);
  assert.equal(isTransitionAllowed("service", "aceito", "em_andamento"), true);
  const now = new Date("2026-09-28T15:00:00-03:00");
  const timerOn = ["sessao", "captacao"] as const;
  const timerOff = ["mix", "master", "beat1", "sonoplastia"] as const;
  for (const id of [...timerOn, ...timerOff]) {
    assert.equal(isTransitionAllowed("appointment", "aceito", "em_andamento"), true, id);
  }
  for (const id of timerOn) {
    assert.equal(hasOperationalTimer(id), true);
    assert.ok(resolveOperationalStartWrite({ tipo: id, existingStartedAt: null, now }));
  }
  for (const id of timerOff) {
    assert.equal(hasOperationalTimer(id), false);
    assert.equal(resolveOperationalStartWrite({ tipo: id, existingStartedAt: null, now }), null);
  }
  ok("Começar/status aceito→em_andamento válido para os 6; timer só sessão/captação");
} catch (e) {
  fail("timer vs status", e);
}

console.log(failed === 0 ? "\noperational-beat-label PASS" : `\noperational-beat-label FAIL (${failed})`);
process.exit(failed === 0 ? 0 : 1);
