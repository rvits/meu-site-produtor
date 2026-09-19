/**
 * ETAPA 5.1 — Payment.asaasPaymentStatus + Admin Pagamentos (sem banco, sem Asaas, sem produção).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  checkoutPaymentMethodFromMetadata,
  getAsaasPaymentStatusPresentation,
  nextAsaasPaymentStatus,
  presentAsaasPaymentStatusLabel,
  presentCheckoutPaymentMethod,
  presentInternalPaymentStatus,
} from "../src/app/lib/asaas-payment-status";
import { isOperationallyApprovedAsaasPaymentEvent } from "../src/app/lib/asaas-approved-payment-event";

function pass(label: string) {
  console.log("PASS", label);
}

const root = path.resolve(__dirname, "..");
function src(rel: string) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

{
  let status = "approved";
  let asaas: string | null = null;
  let rights = 0;
  function materialize(event: string, paymentStatus: string, exists: boolean) {
    const approved = isOperationallyApprovedAsaasPaymentEvent(event, paymentStatus);
    if (approved && !exists) {
      status = "approved";
      asaas = nextAsaasPaymentStatus(null, paymentStatus);
      rights = 1;
      return;
    }
    if (exists) {
      asaas = nextAsaasPaymentStatus(asaas, paymentStatus);
    }
    if (approved && exists) {
      status = "approved";
    }
  }
  materialize("PAYMENT_CONFIRMED", "CONFIRMED", false);
  assert.equal(status, "approved");
  assert.equal(asaas, "CONFIRMED");
  assert.equal(rights, 1);
  pass("CASO 1 CONFIRMED → approved + asaasPaymentStatus CONFIRMED");

  materialize("PAYMENT_RECEIVED", "RECEIVED", true);
  assert.equal(status, "approved");
  assert.equal(asaas, "RECEIVED");
  assert.equal(rights, 1);
  pass("CASO 2 RECEIVED → mesmo Payment, RECEIVED, zero duplicação");

  materialize("PAYMENT_RECEIVED", "RECEIVED", true);
  assert.equal(asaas, "RECEIVED");
  assert.equal(rights, 1);
  pass("CASO 3 replay RECEIVED permanece RECEIVED");

  materialize("PAYMENT_CONFIRMED", "CONFIRMED", true);
  assert.equal(asaas, "RECEIVED");
  assert.equal(status, "approved");
  assert.equal(rights, 1);
  pass("CASO 4 replay atrasado CONFIRMED não regride");
}

{
  const legacy = getAsaasPaymentStatusPresentation(null);
  assert.equal(presentInternalPaymentStatus("approved"), "Aprovado");
  assert.equal(legacy.label, null);
  assert.equal(legacy.showBadge, false);
  assert.notEqual(presentInternalPaymentStatus("approved"), "Confirmado");
  pass("CASO 5 legado approved + null → só Aprovado");
}

{
  assert.equal(presentAsaasPaymentStatusLabel("CONFIRMED"), "Confirmado");
  assert.equal(getAsaasPaymentStatusPresentation("CONFIRMED").showBadge, true);
  pass("CASO 6 approved + CONFIRMED → Confirmado");
}

{
  assert.equal(presentAsaasPaymentStatusLabel("RECEIVED"), "Recebido");
  pass("CASO 7 approved + RECEIVED → Recebido");
}

{
  assert.equal(presentCheckoutPaymentMethod(null), "Não informado");
  assert.equal(presentCheckoutPaymentMethod(""), "Não informado");
  assert.equal(presentCheckoutPaymentMethod("cartao_credito"), "Cartão de Crédito");
  pass("CASO 8 paymentMethod null → Não informado");
}

{
  assert.equal(
    checkoutPaymentMethodFromMetadata({ paymentMethod: "cartao_credito" }),
    "cartao_credito"
  );
  assert.equal(checkoutPaymentMethodFromMetadata({ paymentMethod: "WIRE" }), null);
  assert.equal(checkoutPaymentMethodFromMetadata({}), null);
  pass("CASO 9 metadata.paymentMethod confiável copia; valor estranho não infere");
}

{
  assert.equal(presentInternalPaymentStatus("pending"), "Pendente");
  assert.equal(presentInternalPaymentStatus("rejected"), "Rejeitado");
  assert.equal(presentInternalPaymentStatus("refunded"), "Reembolsado");
  assert.equal(presentInternalPaymentStatus("cancelled"), "Cancelado");
  assert.equal(presentAsaasPaymentStatusLabel("OVERDUE"), null);
  assert.equal(presentAsaasPaymentStatusLabel("weird-status"), null);
  assert.equal(nextAsaasPaymentStatus("RECEIVED", "PENDING"), "RECEIVED");
  assert.equal(nextAsaasPaymentStatus("CONFIRMED", "PENDING"), "CONFIRMED");
  pass("internos mapeados; Asaas desconhecido sem tradução inventada");
}

{
  const orch = src("src/app/lib/process-payment-webhook.ts");
  const route = src("src/app/api/webhooks/asaas/route.ts");
  const schema = src("prisma/schema.prisma");
  const admin = src("src/app/admin/pagamentos/page.tsx");
  const sucesso = src("src/app/pagamentos/sucesso/page.tsx");
  const migration = src(
    "prisma/migrations/20260918200000_payment_asaas_payment_status/migration.sql"
  );
  assert.match(schema, /asaasPaymentStatus\s+String\?/);
  assert.match(migration, /ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "asaasPaymentStatus" TEXT/);
  assert.match(orch, /asaasPaymentStatus: normalizeAsaasPaymentStatus\(status\)/);
  assert.match(orch, /checkoutPaymentMethodFromMetadata\(/);
  assert.match(orch, /persistAsaasPaymentStatus/);
  assert.match(route, /persistAsaasPaymentStatus/);
  assert.match(route, /asaasPaymentStatus: normalizeAsaasPaymentStatus\(status\)/);
  assert.match(admin, /presentAsaasPaymentStatusLabel/);
  assert.match(admin, /presentCheckoutPaymentMethod/);
  assert.doesNotMatch(sucesso, /asaasPaymentStatus/);
  pass("contratos: schema/migration/webhook/admin; sucesso sem asaasPaymentStatus");
}

console.log(JSON.stringify({ reportId: "asaas-payment-status-admin-smoke", pass: true }, null, 2));
