/**
 * Identidade atômica Appointment/Service (1 Beat vs sessao).
 * Sem Prisma, sem Asaas, sem dados pessoais.
 */
import assert from "node:assert/strict";
import {
  CHECKOUT_CATALOG,
  normalizeServiceTypeId,
  priceCheckoutItems,
  requireAtomicServiceTypeId,
  totalPricedCheckoutItems,
} from "../src/app/lib/service-catalog";
import {
  clientTipoConflictsWithDerived,
  deriveAppointmentTipoFromPurchase,
  itemOpensImmediateAppointment,
  MultipleAtomicOrdersError,
  optionalSingleAppointmentTipoForMetadata,
} from "../src/app/lib/appointment-service-type";
import { expandPurchaseToServiceOrders } from "../src/app/lib/service-orders";

let failed = 0;
function ok(label: string) {
  console.log("PASS", label);
}
function fail(label: string, err: unknown) {
  failed += 1;
  console.error("FAIL", label, err);
}

function expectThrow(label: string, fn: () => unknown) {
  try {
    fn();
    fail(label, "expected throw");
  } catch {
    ok(label);
  }
}

const ATOMICS = ["sessao", "captacao", "mix", "master", "beat1", "sonoplastia"] as const;

{
  for (const id of ATOMICS) {
    try {
      const bucket = CHECKOUT_CATALOG[id].category === "beat" ? "beats" : "services";
      const line = { id, quantidade: 1 };
      const services = bucket === "services" ? [line] : [];
      const beats = bucket === "beats" ? [line] : [];
      const derived = deriveAppointmentTipoFromPurchase({
        services,
        beats,
        clientTipo: "sessao",
      });
      assert.equal(derived, id);
      const priced = priceCheckoutItems(
        [line],
        CHECKOUT_CATALOG[id].category
      );
      assert.equal(priced[0].id, id);
      ok(`matriz ${id}: Appointment/Service tipo=${id}`);
    } catch (e) {
      fail(`matriz ${id}`, e);
    }
  }
}

{
  try {
    const beats = priceCheckoutItems([{ id: "beat1", quantidade: 1 }], "beat");
    const subtotal = totalPricedCheckoutItems(beats);
    const discount = 75;
    const total = Math.round((subtotal - discount) * 100) / 100;
    const derived = deriveAppointmentTipoFromPurchase({
      services: [],
      beats,
      clientTipo: "sessao",
    });
    assert.equal(subtotal, 150);
    assert.equal(total, 75);
    assert.equal(derived, "beat1");
    assert.equal(beats[0].id, "beat1");
    const metadata = {
      tipo: "agendamento",
      tipoAgendamento: derived,
      beats,
    };
    assert.equal(metadata.tipoAgendamento, "beat1");
    assert.equal(metadata.beats[0].id, "beat1");
    assert.notEqual(metadata.tipoAgendamento, "sessao");
    assert.equal(clientTipoConflictsWithDerived("sessao", derived), true);
    ok("incidente 1 Beat + cupom fixed 75 → tipo beat1 (não sessao)");
  } catch (e) {
    fail("incidente 1 Beat", e);
  }
}

expectThrow("tipo vazio rejeitado", () =>
  deriveAppointmentTipoFromPurchase({ services: [], beats: [] })
);
expectThrow("tipo desconhecido rejeitado", () =>
  deriveAppointmentTipoFromPurchase({
    services: [{ id: "xyz_desconhecido", quantidade: 1 }],
    beats: [],
  })
);
{
  try {
    const derived = deriveAppointmentTipoFromPurchase({
      services: [],
      beats: [{ id: "beat1", quantidade: 1 }],
      clientTipo: "sessao",
    });
    assert.equal(derived, "beat1");
    assert.equal(clientTipoConflictsWithDerived("sessao", derived), true);
    ok("cliente envia sessao + item beat1 → NÃO gera sessao");
  } catch (e) {
    fail("cliente sessao vs beat1", e);
  }
}
{
  try {
    const derived = deriveAppointmentTipoFromPurchase({
      services: [{ id: "mix", quantidade: 1 }],
      beats: [],
      clientTipo: "sessao",
    });
    assert.equal(derived, "mix");
    ok("cliente envia sessao + item mix → mix");
  } catch (e) {
    fail("cliente sessao vs mix", e);
  }
}

{
  try {
    assert.equal(normalizeServiceTypeId("beat"), "beat1");
    assert.equal(requireAtomicServiceTypeId("beat"), "beat1");
    assert.equal(normalizeServiceTypeId(""), "");
    assert.notEqual(normalizeServiceTypeId(""), "sessao");
    ok("beat → beat1; vazio não cai em sessao");
  } catch (e) {
    fail("beat vs beat1", e);
  }
}

const composites: Array<[string, string[]]> = [
  ["beat2", ["beat1", "beat1"]],
  ["beat3", ["beat1", "beat1", "beat1"]],
  ["beat4", ["beat1", "beat1", "beat1", "beat1"]],
  ["mix_master", ["mix", "master"]],
  ["beat_mix_master", ["beat1", "mix", "master"]],
  [
    "producao_completa",
    ["sessao", "sessao", "captacao", "captacao", "beat1", "mix", "master"],
  ],
];

for (const [sku, expected] of composites) {
  try {
    const item = CHECKOUT_CATALOG[sku as keyof typeof CHECKOUT_CATALOG];
    const services = item.category === "service" ? [{ id: sku, quantidade: 1 }] : [];
    const beats = item.category === "beat" ? [{ id: sku, quantidade: 1 }] : [];
    const types = expandPurchaseToServiceOrders(services, beats).map((o) => o.serviceType);
    assert.deepEqual(types, expected);
    assert.equal(item.preco, CHECKOUT_CATALOG[sku as keyof typeof CHECKOUT_CATALOG].preco);
    ok(`composto ${sku} → ${expected.join("+")} (preço ${item.preco})`);

    let derivedFirst = false;
    try {
      const derived = deriveAppointmentTipoFromPurchase({ services, beats });
      derivedFirst = derived === expected[0];
    } catch (error) {
      assert.ok(error instanceof MultipleAtomicOrdersError, `${sku} deve ser TIPO_SERVICO_MULTIPLO`);
    }
    assert.equal(derivedFirst, false, `${sku} não pode virar Appointment ${expected[0]}`);
    assert.equal(
      optionalSingleAppointmentTipoForMetadata({ services, beats }),
      undefined,
      `${sku} sem tipoAgendamento de Appointment único`
    );
    assert.equal(
      itemOpensImmediateAppointment({
        services,
        beats,
        data: "2026-09-25",
        hora: "19:00",
      }),
      false,
      `${sku} + data/hora não abre Appointment único`
    );
    ok(`multi-right ${sku} não materializa Appointment ${expected[0]}`);
  } catch (e) {
    fail(`composto ${sku}`, e);
  }
}

{
  try {
    assert.equal(
      itemOpensImmediateAppointment({
        services: [{ id: "mix_master", quantidade: 1 }],
        beats: [],
        data: "2026-09-25",
        hora: "22:00",
      }),
      false
    );
    ok("carrinho malformado mix_master + data/hora não cria Appointment mix");
  } catch (e) {
    fail("carrinho malformado mix_master", e);
  }
}

{
  try {
    assert.equal(
      itemOpensImmediateAppointment({
        services: [],
        beats: [{ id: "beat2", quantidade: 1 }],
        data: "2026-09-25",
        hora: "19:00",
      }),
      false
    );
    ok("carrinho malformado beat2 + data/hora não cria Appointment beat1");
  } catch (e) {
    fail("carrinho malformado beat2", e);
  }
}

{
  try {
    const tipo = deriveAppointmentTipoFromPurchase({
      services: [],
      beats: [{ id: "beat1", quantidade: 1 }],
    });
    assert.equal(tipo, "beat1");
    ok("zero-total atômico beat1 continua Appointment beat1");
  } catch (e) {
    fail("zero-total beat1", e);
  }
}

{
  try {
    deriveAppointmentTipoFromPurchase({
      services: [{ id: "mix_master", quantidade: 1 }],
      beats: [],
    });
    fail("zero-total mix_master", "deveria rejeitar");
  } catch (error) {
    assert.ok(error instanceof MultipleAtomicOrdersError);
    ok("zero-total mix_master não cria Appointment mix");
  }
}

{
  try {
    deriveAppointmentTipoFromPurchase({
      services: [],
      beats: [{ id: "beat2", quantidade: 1 }],
    });
    fail("zero-total beat2", "deveria rejeitar");
  } catch (error) {
    assert.ok(error instanceof MultipleAtomicOrdersError);
    ok("zero-total beat2 não cria Appointment beat1");
  }
}

{
  try {
    const tipo = deriveAppointmentTipoFromPurchase({
      services: [],
      beats: [],
      couponServiceType: "beat1",
    });
    assert.equal(tipo, "beat1");
    ok("cupom de direito beat1 → Appointment beat1");
  } catch (e) {
    fail("cupom direito beat1", e);
  }
}

{
  try {
    assert.equal(CHECKOUT_CATALOG.beat1.preco, 150);
    assert.equal(CHECKOUT_CATALOG.sessao.preco, 40);
    assert.equal(CHECKOUT_CATALOG.mix.preco, 110);
    ok("preços de catálogo intactos");
  } catch (e) {
    fail("preços", e);
  }
}

if (failed > 0) {
  console.error(`FAILED ${failed}`);
  process.exit(1);
}
console.log("appointment-tipo-identity-smoke: all passed");
