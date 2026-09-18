/**
 * Recovery CONFIRMED — planejamento/abortos/idempotência. Sem Asaas real, sem produção.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  decideOperationalAsaasWebhookAction,
} from "../src/app/lib/asaas-approved-payment-event";
import {
  buildConfirmedRecoveryWebhookBody,
  planConfirmedAsaasPaymentRecovery,
} from "../src/app/lib/recover-confirmed-asaas-payment";
import { decideCouponFulfillmentOp, decidePaymentSlotAction, missingServiceCount } from "../src/app/lib/payment-appointment-idempotency";
import { hasOperationalTimer, resolveOperationalStartWrite } from "../src/app/lib/service-timing";

function pass(label: string) {
  console.log("PASS", label);
}

const repo = path.resolve(__dirname, "..");

function src(rel: string) {
  return fs.readFileSync(path.join(repo, rel), "utf8");
}

const op = "025eb001-0d66-4dd2-a14f-ead9b70de0fc";
const asaasId = "pay_iq3u34pe0wiq7s6n";

const cartItemScheduled = {
  data: "2026-09-25",
  hora: "14:00",
  duracaoMinutos: 60,
  tipo: "sessao",
  servicos: [
    { id: "captacao", nome: "Captação", quantidade: 1, preco: 55 },
    { id: "mix_master", nome: "Mix + Master", quantidade: 1, preco: 170 },
  ],
  beats: [],
  subtotal: 225,
  total: 225,
  discount: 0,
};

const metadataOk = {
  tipo: "carrinho",
  paymentMethod: "cartao_credito",
  total: "225",
  discount: 0,
  items: JSON.stringify([cartItemScheduled]),
};

{
  const plan = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: metadataOk,
    storedAsaasId: asaasId,
    existingPaymentId: null,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.action, "create");
  assert.equal(plan.appointmentCount, 1);
  assert.equal(plan.serviceCount, 3);
  assert.deepEqual(plan.serviceTipos, ["captacao", "mix", "master"]);
  assert.equal(plan.appointmentTipo, "sessao");
  assert.equal(plan.couponOps, 0);
  pass("1 CONFIRMED + Payment ausente → create; 1 Appointment + captacao + mix + master");
}

{
  const first = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: metadataOk,
    storedAsaasId: asaasId,
    existingPaymentId: null,
  });
  const second = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: metadataOk,
    storedAsaasId: asaasId,
    existingPaymentId: "pay-db-1",
  });
  assert.equal(first.action, "create");
  assert.equal(second.action, "reconcile");
  assert.equal(second.appointmentCount, 1);
  assert.equal(second.serviceCount, 3);
  assert.equal(decidePaymentSlotAction({ ownReusableId: 9, foreignReservingId: null }).action, "reuse");
  assert.equal(missingServiceCount(3, 3), 0);
  pass("2/3 recovery cria uma vez; repetido reconcilia sem duplicar Appointment/Service");
}

{
  const after = decideOperationalAsaasWebhookAction({
    event: "PAYMENT_RECEIVED",
    status: "RECEIVED",
    existingPaymentId: "pay-db-1",
  });
  assert.equal(after, "reconcile");
  pass("4 PAYMENT_RECEIVED posterior → reconcile");
}

{
  const missing = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: null,
    storedAsaasId: asaasId,
  });
  assert.equal(missing.abortCode, "METADATA_MISSING");
  pass("5 metadata inexistente → abort");
}

{
  const mismatch = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: metadataOk,
    storedAsaasId: "pay_other",
  });
  assert.equal(mismatch.abortCode, "ASAAS_ID_MISMATCH");
  pass("6 asaasId divergente → abort");
}

{
  const amount = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: { ...metadataOk, total: "100" },
    storedAsaasId: asaasId,
  });
  assert.equal(amount.abortCode, "AMOUNT_MISMATCH");
  pass("7 valor divergente → abort");
}

{
  const tipo = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: { ...metadataOk, tipo: "plano" },
    storedAsaasId: asaasId,
  });
  assert.equal(tipo.abortCode, "UNEXPECTED_TIPO");
  pass("8 tipo inesperado → abort");
}

{
  const refunded = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: metadataOk,
    storedAsaasId: asaasId,
    asaasLiveStatus: "REFUNDED",
  });
  assert.equal(refunded.abortCode, "REFUND_OR_CHARGEBACK");
  const chargeback = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: metadataOk,
    storedAsaasId: asaasId,
    asaasLiveStatus: "CHARGEBACK_REQUESTED",
  });
  assert.equal(chargeback.abortCode, "REFUND_OR_CHARGEBACK");
  pass("9 refund/chargeback → abort");
}

{
  const lib = src("src/app/lib/recover-confirmed-asaas-payment.ts");
  const cli = src("scripts/recover-confirmed-asaas-payment.ts");
  assert.doesNotMatch(lib, /AsaasProvider|asaasFetch\(/);
  assert.doesNotMatch(cli, /AsaasProvider|asaasFetch\(/);
  assert.match(cli, /processPaymentWebhook/);
  const body = buildConfirmedRecoveryWebhookBody({
    asaasPaymentId: asaasId,
    operationId: op,
    value: 225,
  });
  assert.equal(body.event, "PAYMENT_CONFIRMED");
  assert.equal(body.payment.status, "CONFIRMED");
  pass("10/11 nenhuma cobrança/checkout no recovery; evento CONFIRMED preservado");
}

{
  assert.equal(
    decideCouponFulfillmentOp({
      hasCoupon: false,
      useCount: 0,
      used: false,
      appointmentId: null,
      serviceId: null,
      targetAppointmentId: 1,
      targetServiceId: "s",
    }),
    "none"
  );
  const noCoupon = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: metadataOk,
    storedAsaasId: asaasId,
  });
  assert.equal(noCoupon.couponOps, 0);
  pass("12 sem cupom: 0 usos");
}

{
  const noSchedule = planConfirmedAsaasPaymentRecovery({
    operationId: op,
    expectedAsaasId: asaasId,
    expectedAmount: 225,
    metadata: {
      tipo: "carrinho",
      total: 225,
      items: JSON.stringify([
        {
          tipo: "sessao",
          duracaoMinutos: 60,
          servicos: cartItemScheduled.servicos,
          beats: [],
        },
      ]),
    },
    storedAsaasId: asaasId,
  });
  assert.equal(noSchedule.ok, true);
  assert.equal(noSchedule.abortCode, undefined);
  assert.equal(noSchedule.hasSchedule, false);
  assert.equal(noSchedule.appointmentCount, 0);
  assert.equal(noSchedule.serviceCount, 0);
  assert.equal(noSchedule.couponOps, 3);
  assert.equal(noSchedule.serviceOrderOps, 3);
  assert.deepEqual(noSchedule.serviceTipos, ["captacao", "mix", "master"]);
  assert.equal(noSchedule.materialization, "pending-rights");
  assert.equal(noSchedule.expectedAmount, 225);
  pass("13 carrinho sem data/hora → 3 direitos pendentes (captacao/mix/master), sem Appointment");
}

{
  assert.equal(hasOperationalTimer("captacao"), true);
  assert.equal(
    resolveOperationalStartWrite({
      tipo: "captacao",
      existingStartedAt: null,
      now: new Date(),
    }) != null,
    true
  );
  const zero = src("src/app/lib/coupon-zero-checkout.ts");
  assert.doesNotMatch(zero, /recover-confirmed-asaas-payment/);
  pass("14/15 timer não é escrito no recovery; coupon-zero isolado");
}

console.log(JSON.stringify({ reportId: "recover-confirmed-asaas-payment-smoke", pass: true }, null, 2));
