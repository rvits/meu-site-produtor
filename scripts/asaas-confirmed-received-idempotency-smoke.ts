/**
 * Incidente: cartão PAYMENT_CONFIRMED ignorado; RECEIVED posterior não deve duplicar.
 * Sem Asaas real, sem cobrança, sem produção, sem banco.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  decideOperationalAsaasWebhookAction,
  isOperationallyApprovedAsaasPaymentEvent,
  isPrismaUniqueConstraintError,
} from "../src/app/lib/asaas-approved-payment-event";
import {
  decideCouponFulfillmentOp,
  decidePaymentSlotAction,
  missingServiceCount,
  shouldSendFulfillmentEmails,
} from "../src/app/lib/payment-appointment-idempotency";
import { recordApprovedPaymentCouponUse } from "../src/app/lib/promotional-coupon";
import { simulationDomainWebhookInput } from "../src/app/lib/simulation-domain-webhook-input";
import { hasOperationalTimer, resolveOperationalStartWrite } from "../src/app/lib/service-timing";

function pass(label: string) {
  console.log("PASS", label);
}

const repoRoot = path.resolve(__dirname, "..");

function readSrc(rel: string) {
  return fs.readFileSync(path.join(repoRoot, rel), "utf8");
}

{
  assert.equal(
    isOperationallyApprovedAsaasPaymentEvent("PAYMENT_CONFIRMED", "CONFIRMED"),
    true
  );
  assert.equal(
    decideOperationalAsaasWebhookAction({
      event: "PAYMENT_CONFIRMED",
      status: "CONFIRMED",
      existingPaymentId: null,
    }),
    "create"
  );
  const afterConfirmed = decideOperationalAsaasWebhookAction({
    event: "PAYMENT_RECEIVED",
    status: "RECEIVED",
    existingPaymentId: "pay-db-1",
  });
  assert.equal(afterConfirmed, "reconcile");
  assert.equal(
    decidePaymentSlotAction({ ownReusableId: 10, foreignReservingId: null }).action,
    "reuse"
  );
  assert.equal(missingServiceCount(1, 1), 0);
  pass("1 cartão CONFIRMED cria; RECEIVED reconcilia o mesmo Payment/Appointment/Service");
}

{
  assert.equal(
    decideOperationalAsaasWebhookAction({
      event: "PAYMENT_CONFIRMED",
      status: "CONFIRMED",
      existingPaymentId: "pay-db-1",
    }),
    "reconcile"
  );
  pass("2 retry CONFIRMED é reconcile, não create");
}

{
  assert.equal(
    isOperationallyApprovedAsaasPaymentEvent("PAYMENT_RECEIVED", "RECEIVED"),
    true
  );
  assert.equal(
    decideOperationalAsaasWebhookAction({
      event: "PAYMENT_RECEIVED",
      status: "RECEIVED",
      existingPaymentId: "pay-db-1",
    }),
    "reconcile"
  );
  pass("3 retry RECEIVED é reconcile, não create");
}

{
  assert.equal(
    isOperationallyApprovedAsaasPaymentEvent("PAYMENT_RECEIVED", "RECEIVED"),
    true
  );
  assert.equal(
    isOperationallyApprovedAsaasPaymentEvent("PAYMENT_RECEIVED", "CONFIRMED"),
    true
  );
  assert.equal(
    decideOperationalAsaasWebhookAction({
      event: "PAYMENT_RECEIVED",
      status: "RECEIVED",
      existingPaymentId: null,
    }),
    "create"
  );
  pass("4 PIX PAYMENT_RECEIVED / RECEIVED continua no pipeline aprovado");
}

{
  assert.equal(
    isOperationallyApprovedAsaasPaymentEvent("PAYMENT_CONFIRMED", "CONFIRMED"),
    true
  );
  assert.equal(
    decideOperationalAsaasWebhookAction({
      event: "PAYMENT_CONFIRMED",
      status: "CONFIRMED",
      existingPaymentId: null,
    }),
    "create"
  );
  pass("5 boleto CONFIRMED entra no mesmo pipeline operacional");
}

{
  const invalid: Array<[string, string]> = [
    ["PAYMENT_CREATED", "PENDING"],
    ["PAYMENT_UPDATED", "PENDING"],
    ["PAYMENT_OVERDUE", "OVERDUE"],
    ["PAYMENT_DELETED", "DELETED"],
    ["PAYMENT_REFUNDED", "REFUNDED"],
    ["PAYMENT_REFUND_IN_PROGRESS", "REFUND_IN_PROGRESS"],
    ["PAYMENT_CHARGEBACK_REQUESTED", "CHARGEBACK_REQUESTED"],
    ["PAYMENT_CHARGEBACK_DISPUTE", "CHARGEBACK_DISPUTE"],
    ["PAYMENT_AWAITING_CHARGEBACK_REVERSAL", "AWAITING_CHARGEBACK_REVERSAL"],
    ["PAYMENT_REPROVED_BY_RISK_ANALYSIS", "PENDING"],
    ["PAYMENT_AWAITING_RISK_ANALYSIS", "AWAITING_RISK_ANALYSIS"],
    ["PAYMENT_AUTHORIZED", "PENDING"],
    ["PAYMENT_RECEIVED", "PENDING"],
    ["PAYMENT_CONFIRMED", "PENDING"],
    ["PAYMENT_RECEIVED", "OVERDUE"],
    ["PAYMENT_RECEIVED", "REFUNDED"],
    ["PAYMENT_CONFIRMED", "REFUNDED"],
    ["PAYMENT_CREATED", "CONFIRMED"],
    ["PAYMENT_REFUNDED", "CONFIRMED"],
  ];
  for (const [event, status] of invalid) {
    assert.equal(
      isOperationallyApprovedAsaasPaymentEvent(event, status),
      false,
      `${event} ${status}`
    );
    assert.equal(
      decideOperationalAsaasWebhookAction({ event, status, existingPaymentId: null }),
      "ignore",
      `action ${event} ${status}`
    );
  }
  pass("6 eventos inválidos (PENDING/OVERDUE/REFUNDED/DELETED/CHARGEBACK/REPROVED) não aprovam");
}

void (async () => {
  const stored: Record<string, unknown>[] = [];
  let row = {
    id: "c-confirmed",
    assignedUserId: "artist-1",
    userPlanId: null,
    parentCouponId: null,
    originAppointmentId: null,
    couponType: "desconto",
    discountType: "fixed" as const,
    discountValue: 50,
    applicableServiceTypes: JSON.stringify(["*"]),
    isActive: true,
    used: false,
    useCount: 0,
    maxUses: 1,
    appointmentId: null as number | null,
    serviceId: null as string | null,
    usedBy: null as string | null,
  };
  const fakeDb = {
    coupon: {
      findUnique: async () => ({ ...row }),
      updateMany: async ({
        data,
      }: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        if (data.useCount && typeof data.useCount === "object") {
          if (row.used) return { count: 0 };
          stored.push({ ...data, kind: "increment" });
          row = {
            ...row,
            used: true,
            useCount: 1,
            appointmentId: (data.appointmentId as number) ?? row.appointmentId,
            serviceId: (data.serviceId as string) ?? row.serviceId,
          };
          return { count: 1 };
        }
        stored.push({ ...data, kind: "bind" });
        return { count: 1 };
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        row = { ...row, ...data };
        return row;
      },
    },
  };

  assert.equal(
    decideOperationalAsaasWebhookAction({
      event: "PAYMENT_CONFIRMED",
      status: "CONFIRMED",
      existingPaymentId: null,
    }),
    "create"
  );
  await recordApprovedPaymentCouponUse(fakeDb as never, {
    couponId: "c-confirmed",
    userId: "artist-1",
    appointmentId: 44,
    serviceId: "svc-1",
  });
  assert.equal(row.useCount, 1);

  assert.equal(
    decideOperationalAsaasWebhookAction({
      event: "PAYMENT_RECEIVED",
      status: "RECEIVED",
      existingPaymentId: "pay-db-1",
    }),
    "reconcile"
  );
  await recordApprovedPaymentCouponUse(fakeDb as never, {
    couponId: "c-confirmed",
    userId: "artist-1",
    appointmentId: 44,
    serviceId: "svc-1",
  });
  assert.equal(row.useCount, 1);
  assert.equal(stored.filter((s) => s.kind === "increment").length, 1);
  assert.equal(
    decideCouponFulfillmentOp({
      hasCoupon: true,
      useCount: 1,
      used: true,
      appointmentId: 44,
      serviceId: "svc-1",
      targetAppointmentId: 44,
      targetServiceId: "svc-1",
    }),
    "none"
  );
  pass("7 cupom: CONFIRMED consome uma vez; RECEIVED posterior não incrementa");

  {
    const first = decideOperationalAsaasWebhookAction({
      event: "PAYMENT_CONFIRMED",
      status: "CONFIRMED",
      existingPaymentId: null,
    });
    const second = decideOperationalAsaasWebhookAction({
      event: "PAYMENT_RECEIVED",
      status: "RECEIVED",
      existingPaymentId: "cart-pay",
    });
    assert.equal(first, "create");
    assert.equal(second, "reconcile");
    const itemA = decidePaymentSlotAction({
      ownReusableId: 101,
      foreignReservingId: null,
    });
    const itemB = decidePaymentSlotAction({
      ownReusableId: 102,
      foreignReservingId: null,
    });
    assert.equal(itemA.action, "reuse");
    assert.equal(itemB.action, "reuse");
    assert.equal(missingServiceCount(2, 2), 0);
    pass("8 carrinho: RECEIVED após CONFIRMED reusa Appointments/Services, sem duplicar");
  }

  {
    assert.equal(
      decideOperationalAsaasWebhookAction({
        event: "PAYMENT_CONFIRMED",
        status: "CONFIRMED",
        existingPaymentId: "orphan-approved",
      }),
      "reconcile"
    );
    assert.equal(missingServiceCount(0, 1), 1);
    assert.equal(
      decidePaymentSlotAction({ ownReusableId: null, foreignReservingId: null }).action,
      "create"
    );
    assert.equal(
      shouldSendFulfillmentEmails({
        sendEmailsRequested: false,
        createdAppointmentThisRun: false,
      }),
      false
    );
    pass("9 efeitos parciais: evento válido reconcilia e só cria o que falta");
  }

  {
    const p2002 = { code: "P2002", meta: { target: ["asaasId"] } };
    assert.equal(isPrismaUniqueConstraintError(p2002), true);
    assert.equal(isPrismaUniqueConstraintError(new Error("fail")), false);
    const raced = decideOperationalAsaasWebhookAction({
      event: "PAYMENT_RECEIVED",
      status: "RECEIVED",
      existingPaymentId: "winner-of-race",
    });
    assert.equal(raced, "reconcile");
    pass("corrida unique: perdedor reconcilia em vez de abandonar efeitos");
  }

  {
    const confirmed = simulationDomainWebhookInput({
      event: "PAYMENT_CONFIRMED",
      providerPaymentId: "sim_pay_x",
      value: 40,
      description: "sim",
    });
    assert.equal(confirmed.event, "PAYMENT_CONFIRMED");
    assert.equal(confirmed.payment.status, "CONFIRMED");
    const received = simulationDomainWebhookInput({
      event: "PAYMENT_RECEIVED",
      status: "RECEIVED",
      providerPaymentId: "sim_pay_x",
      value: 40,
      description: "sim",
    });
    assert.equal(received.event, "PAYMENT_RECEIVED");
    assert.equal(received.payment.status, "RECEIVED");
    pass("simulação preserva PAYMENT_CONFIRMED (não reescreve para RECEIVED)");
  }

  {
    const webhook = readSrc("src/app/api/webhooks/asaas/route.ts");
    const orchestrator = readSrc("src/app/lib/process-payment-webhook.ts");
    const sim = readSrc("src/app/lib/payment-provider/simulation-provider.ts");
    const zero = readSrc("src/app/lib/coupon-zero-checkout.ts");
    const sucesso = readSrc("src/app/pagamentos/sucesso/page.tsx");
    assert.match(webhook, /isOperationallyApprovedAsaasPaymentEvent/);
    assert.match(webhook, /persistAsaasPaymentStatus/);
    assert.match(orchestrator, /isOperationallyApprovedAsaasPaymentEvent/);
    assert.match(orchestrator, /asaasPaymentStatus: normalizeAsaasPaymentStatus\(status\)/);
    assert.doesNotMatch(orchestrator, /function isConfirmedPaymentEvent/);
    assert.match(sim, /simulationDomainWebhookInput/);
    assert.doesNotMatch(zero, /processPaymentWebhook|webhooks\/asaas/);
    assert.doesNotMatch(sucesso, /window\.location\.href = "\/minha-conta"/);
    assert.match(sucesso, /Ver meus serviços e agendar/);
    assert.equal(hasOperationalTimer("sessao"), true);
    const start = resolveOperationalStartWrite({
      tipo: "sessao",
      existingStartedAt: null,
      now: new Date("2026-09-18T15:00:00.000Z"),
    });
    assert.ok(start);
    pass("contratos: regra canônica compartilhada; R$ 0 isolado; timer/sucesso intocados");
  }

  console.log(
    JSON.stringify({ reportId: "asaas-confirmed-received-idempotency-smoke", pass: true }, null, 2)
  );
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
