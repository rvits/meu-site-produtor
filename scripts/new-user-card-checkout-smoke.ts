/**
 * Incidente: checkout cartão com conta nova → UI "Expected string, received null".
 * Sem banco, sem Asaas real, sem cobrança.
 */
import assert from "node:assert/strict";
import { z } from "zod";
import {
  agendamentoCheckoutSchema,
  carrinhoCheckoutSchema,
  omitCheckoutJsonNulls,
  publicCheckoutZodMessage,
} from "../src/app/lib/checkout-request-schema";
import {
  sanitizeCartItemsForCheckoutApi,
  toPersistedCartItem,
} from "../src/app/lib/cart-checkout-item";
import { publicContaUpdateZodMessage, updateContaSchema } from "../src/app/lib/validations";
import { CHECKOUT_CATALOG } from "../src/app/lib/service-catalog";

function pass(label: string) {
  console.log("PASS", label);
}

/** Schema anterior típico — reproduz a mensagem do incidente. */
const naiveCartItem = z.object({
  data: z.string().optional(),
  hora: z.string().optional(),
  tipo: z.string().optional(),
  observacoes: z.string().optional(),
  cupomCode: z.string().optional(),
  servicos: z.array(
    z.object({
      id: z.string(),
      nome: z.string().optional(),
      quantidade: z.number(),
    })
  ),
});
const naiveCart = z.object({
  items: z.array(naiveCartItem),
  paymentMethod: z.enum(["cartao_credito", "cartao_debito", "pix", "boleto"]).optional(),
});

/** Espelha o objeto gravado em sessionStorage pelo agendamento (antes da sanitização). */
function rawCartFromAgendamento(params: {
  data: string | null;
  hora: string | null;
  serviceId: keyof typeof CHECKOUT_CATALOG;
  observacoes?: string | null;
  cupomCode?: string | null;
  quantity?: number;
}) {
  const cat = CHECKOUT_CATALOG[params.serviceId];
  return {
    cartId: 1,
    data: params.data,
    hora: params.hora,
    duracaoMinutos: 60,
    tipo: "sessao",
    servicos: [
      {
        id: cat.id,
        nome: cat.nome,
        quantidade: params.quantity ?? 1,
        preco: cat.preco,
      },
    ],
    beats: [] as Array<{ id: string; nome: string; quantidade: number; preco: number }>,
    total: cat.preco * (params.quantity ?? 1),
    observacoes: params.observacoes ?? "",
    cupomCode: params.cupomCode,
  };
}

function checkoutBody(item: Record<string, unknown>, paymentMethod: string) {
  return JSON.parse(
    JSON.stringify({
      items: [item],
      total: item.total,
      paymentMethod,
    })
  ) as unknown;
}

function mockAsaasCheckout(params: {
  payerName: string;
  payerEmail: string;
  payerCpf: string;
  total: number;
  paymentMethod?: string;
  operationId: string;
}) {
  assert.equal(typeof params.payerName, "string");
  assert.ok(params.payerName.length >= 2);
  assert.equal(typeof params.payerEmail, "string");
  assert.ok(params.payerEmail.includes("@"));
  assert.match(params.payerCpf, /^\d{11}$/);
  assert.ok(params.total > 0, "checkout pago não deve ir ao Asaas com total 0");
  assert.ok(params.operationId.length > 0);
  return {
    billingType: "UNDEFINED" as const,
    initPoint: "https://sandbox.asaas.com/i/mock-no-charge",
    preferenceId: "pay_mock_isolated",
    paymentMethodStoredInMetadataOnly: params.paymentMethod ?? null,
  };
}

{
  const serialized = checkoutBody(
    rawCartFromAgendamento({
      data: null,
      hora: null,
      serviceId: "sessao",
      quantity: 2,
      observacoes: null,
      cupomCode: null,
    }) as unknown as Record<string, unknown>,
    "cartao_credito"
  );
  const naive = naiveCart.safeParse(serialized);
  assert.equal(naive.success, false);
  const msg = naive.success ? "" : naive.error.issues[0]?.message;
  assert.equal(msg, "Expected string, received null");
  pass("1 causa raiz: Zod 3 z.string().optional() + JSON null = mensagem do incidente");
}

{
  const raw = rawCartFromAgendamento({
    data: null,
    hora: null,
    serviceId: "mix",
    observacoes: null,
    cupomCode: null,
  });
  const persisted = toPersistedCartItem(raw);
  assert.equal("data" in persisted, false);
  assert.equal("hora" in persisted, false);
  assert.equal("observacoes" in persisted, false);
  assert.equal("cupomCode" in persisted, false);
  const roundTrip = JSON.parse(JSON.stringify(persisted)) as Record<string, unknown>;
  assert.equal(JSON.stringify(roundTrip).includes(":null"), false);
  pass("2 persistência do carrinho omite null (não converte para string vazia)");
}

const newUserOptionalNulls = {
  nomeSocial: null as string | null,
  cep: null as string | null,
  foto: null as string | null,
  estilosMusicais: null as string | null,
  nacionalidade: null as string | null,
  generoOutro: null as string | null,
};

{
  const patch = {
    nomeArtistico: "Artista Nova",
    dataNascimento: null,
    cpf: "52998224725",
    pais: "Brasil",
    cidade: "São Paulo",
    bairro: "Centro",
    cep: newUserOptionalNulls.cep,
  };
  const parsed = updateContaSchema.safeParse(patch);
  assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.message);
  if (parsed.success) {
    assert.equal(parsed.data.dataNascimento, undefined);
    assert.equal(parsed.data.cep, undefined);
  }
  pass("3 PATCH conta: null opcional = omitir, não apagar CPF/CEP com string vazia");
}

{
  const leaked = naiveCart.safeParse(
    checkoutBody(
      rawCartFromAgendamento({ data: null, hora: null, serviceId: "sessao" }) as unknown as Record<
        string,
        unknown
      >,
      "cartao_credito"
    )
  );
  assert.equal(leaked.success, false);
  const publicMsg = publicCheckoutZodMessage(leaked.error);
  assert.equal(/expected|received/i.test(publicMsg), false);
  pass("4 mensagem pública não vaza 'Expected string, received null'");
}

{
  const failNome = updateContaSchema.safeParse({ nomeArtistico: null });
  assert.equal(failNome.success, true);
  const failCpfType = z.object({ cpf: z.string() }).safeParse({ cpf: null });
  assert.equal(failCpfType.success, false);
  const mapped = publicContaUpdateZodMessage(failCpfType.error);
  assert.equal(/expected|received/i.test(mapped), false);
  pass("5 conta/update não devolve mensagem interna de tipo");
}

const matrix: Array<{
  label: string;
  user: "novo" | "antigo";
  method: "cartao_credito" | "pix";
  serviceId: keyof typeof CHECKOUT_CATALOG;
  data: string | null;
  hora: string | null;
  cupomCode: string | null;
  quantity: number;
}> = [
  {
    label: "novo/cartão/sessão qty2 (agenda fechada → data/hora null)",
    user: "novo",
    method: "cartao_credito",
    serviceId: "sessao",
    data: null,
    hora: null,
    cupomCode: null,
    quantity: 2,
  },
  {
    label: "novo/PIX/sessão qty2",
    user: "novo",
    method: "pix",
    serviceId: "sessao",
    data: null,
    hora: null,
    cupomCode: null,
    quantity: 2,
  },
  {
    label: "novo/cartão/sessão unitária com agenda",
    user: "novo",
    method: "cartao_credito",
    serviceId: "sessao",
    data: "2026-10-01",
    hora: "14:00",
    cupomCode: null,
    quantity: 1,
  },
  {
    label: "novo/cartão/captação unitária",
    user: "novo",
    method: "cartao_credito",
    serviceId: "captacao",
    data: "2026-10-01",
    hora: "15:00",
    cupomCode: null,
    quantity: 1,
  },
  {
    label: "novo/cartão/mix (produção — data, hora default no cliente)",
    user: "novo",
    method: "cartao_credito",
    serviceId: "mix",
    data: "2026-10-10",
    hora: "12:00",
    cupomCode: null,
    quantity: 1,
  },
  {
    label: "antigo/cartão/sessão",
    user: "antigo",
    method: "cartao_credito",
    serviceId: "sessao",
    data: "2026-09-20",
    hora: "11:00",
    cupomCode: null,
    quantity: 1,
  },
  {
    label: "antigo/PIX/sessão",
    user: "antigo",
    method: "pix",
    serviceId: "sessao",
    data: "2026-09-20",
    hora: "11:00",
    cupomCode: null,
    quantity: 1,
  },
  {
    label: "novo/cartão/cupom parcial (código string)",
    user: "novo",
    method: "cartao_credito",
    serviceId: "sessao",
    data: "2026-10-01",
    hora: "14:00",
    cupomCode: "PROMO10",
    quantity: 1,
  },
  {
    label: "novo/cartão/cupom campo null",
    user: "novo",
    method: "cartao_credito",
    serviceId: "sessao",
    data: "2026-10-01",
    hora: "14:00",
    cupomCode: null,
    quantity: 1,
  },
];

for (const row of matrix) {
  const raw = rawCartFromAgendamento({
    data: row.data,
    hora: row.hora,
    serviceId: row.serviceId,
    cupomCode: row.cupomCode,
    quantity: row.quantity,
    observacoes: row.user === "novo" ? null : "ok",
  });
  const serialized = checkoutBody(raw as unknown as Record<string, unknown>, row.method);
  const omitted = omitCheckoutJsonNulls(serialized);
  const parsed = carrinhoCheckoutSchema.safeParse(omitted);
  assert.equal(parsed.success, true, `${row.label}: ${parsed.success ? "" : parsed.error.message}`);
  const sanitized = sanitizeCartItemsForCheckoutApi(
    ((serialized as { items: Array<Record<string, unknown>> }).items)
  );
  const parsedSanitized = carrinhoCheckoutSchema.safeParse({
    items: sanitized,
    paymentMethod: row.method,
  });
  assert.equal(parsedSanitized.success, true, row.label + " sanitize");
  if (parsed.success && CHECKOUT_CATALOG[row.serviceId].preco * row.quantity > 0) {
    const asaas = mockAsaasCheckout({
      payerName: row.user === "novo" ? "Artista Nova" : "Cliente Antigo",
      payerEmail: row.user === "novo" ? "nova@example.com" : "antiga@example.com",
      payerCpf: "52998224725",
      total: CHECKOUT_CATALOG[row.serviceId].preco * row.quantity,
      paymentMethod: row.method,
      operationId: "op_mock",
    });
    assert.match(asaas.initPoint, /^https:\/\//);
    assert.equal(asaas.billingType, "UNDEFINED");
  }
  pass(`matriz ${row.label}`);
}

{
  const zeroBody = omitCheckoutJsonNulls(
    checkoutBody(
      rawCartFromAgendamento({
        data: "2026-10-01",
        hora: "14:00",
        serviceId: "sessao",
        cupomCode: "FULL100",
      }) as unknown as Record<string, unknown>,
      "cartao_credito"
    )
  );
  const parsed = carrinhoCheckoutSchema.safeParse(zeroBody);
  assert.equal(parsed.success, true);
  pass("6 schema aceita cupom 100%; Asaas não é chamado quando total<=0 (ramo da rota)");
}

{
  const parsed = agendamentoCheckoutSchema.safeParse({
    servicos: [{ id: "sessao", quantidade: 1 }],
    data: "2026-10-01",
    hora: "14:00",
    paymentMethod: "cartao_credito",
    cupomCode: null,
    observacoes: null,
  });
  assert.equal(parsed.success, true, parsed.success ? "" : parsed.error.message);
  pass("7 checkout-agendamento aceita null em opcionais + cartão");
}

{
  const parsed = carrinhoCheckoutSchema.safeParse({
    items: [
      {
        servicos: [{ id: null, quantidade: 1 }],
        data: "2026-10-01",
        hora: "14:00",
      },
    ],
    paymentMethod: "cartao_credito",
  });
  assert.equal(parsed.success, false);
  const msg = publicCheckoutZodMessage(parsed.error);
  assert.equal(/expected|received/i.test(msg), false);
  pass("8 id de serviço null → mensagem de negócio, não Zod interno");
}

{
  const desktop = carrinhoCheckoutSchema.safeParse(
    omitCheckoutJsonNulls(
      checkoutBody(
        rawCartFromAgendamento({
          data: null,
          hora: null,
          serviceId: "sessao",
          quantity: 2,
        }) as unknown as Record<string, unknown>,
        "cartao_credito"
      )
    )
  );
  const mobile = carrinhoCheckoutSchema.safeParse(
    omitCheckoutJsonNulls(
      checkoutBody(
        rawCartFromAgendamento({
          data: null,
          hora: null,
          serviceId: "sessao",
          quantity: 2,
        }) as unknown as Record<string, unknown>,
        "cartao_credito"
      )
    )
  );
  assert.equal(desktop.success, mobile.success);
  pass("9 mesma validação sem branch de viewport");
}

console.log("OK new-user-card-checkout-smoke");
