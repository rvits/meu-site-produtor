/**
 * Agendamento por direito: Sessão/Captação exigem hora; Mix/Master/Beat/Sonoplastia
 * só data de entrega. Cupom zerado não abre cobrança. Sem banco.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { serviceNeedsStudioHours } from "../src/app/agendamento/scheduling-shared";
import { couponScheduleHref, isAvailableScheduleCoupon } from "../src/app/minha-conta/portal-ui/helpers";
import { agendamentoBloqueiaReusoCupom } from "../src/app/lib/coupon-booking-rules";
import type { Cupom } from "../src/app/minha-conta/portal-ui/types";

function pass(label: string) {
  console.log("PASS", label);
}

assert.equal(serviceNeedsStudioHours("sessao"), true);
assert.equal(serviceNeedsStudioHours("captacao"), true);
pass("1/2 Sessão e Captação exigem data + horário");

for (const tipo of ["mix", "master", "beat1", "sonoplastia"] as const) {
  assert.equal(serviceNeedsStudioHours(tipo), false, tipo);
}
pass("3–5 Mix/Master/Beat/Sonoplastia: só data de entrega (sem hora de estúdio)");

const pending: Cupom = {
  id: "c1",
  code: "PEND-MIX-1",
  couponType: "SERVICE",
  canonicalCouponType: "SERVICE",
  couponCategory: "producao",
  discountType: "service",
  discountValue: 0,
  serviceType: "mix",
  status: "disponivel",
  used: false,
};
assert.equal(isAvailableScheduleCoupon(pending), true);
assert.equal(couponScheduleHref(pending), "/agendamento/cupom/PEND-MIX-1");
pass("6 pending-right inicia /agendamento/cupom/:codigo");

const sessaoCoupon: Cupom = {
  ...pending,
  id: "c2",
  code: "PEND-SES-1",
  couponCategory: "servico",
  serviceType: "sessao",
};
assert.equal(couponScheduleHref(sessaoCoupon), "/agendamento/cupom/PEND-SES-1");
pass("Coupon de Sessão também usa agenda exclusiva");

const root = path.resolve(__dirname, "..");
const comCupom = fs.readFileSync(
  path.join(root, "src/app/api/agendamentos/com-cupom/route.ts"),
  "utf8"
);
assert.match(comCupom, /finalTotal > 0/);
assert.match(comCupom, /Ainda há valor a pagar/);
assert.match(comCupom, /fulfillZeroTotalCouponAppointment/);
assert.doesNotMatch(comCupom, /from ["']@\/app\/lib\/asaas/);
assert.doesNotMatch(comCupom, /checkout-carrinho/);
pass("7 com-cupom só cumpre total zero — sem nova cobrança Asaas");

const zeroCheckout = fs.readFileSync(
  path.join(root, "src/app/lib/coupon-zero-checkout.ts"),
  "utf8"
);
assert.match(zeroCheckout, /Este cupom já foi utilizado/);
assert.match(zeroCheckout, /coupon\.used/);
assert.equal(agendamentoBloqueiaReusoCupom("pendente"), true);
assert.equal(agendamentoBloqueiaReusoCupom("aceito"), true);
pass("8 consumo idempotente: cupom used / appointment vinculado bloqueia reuso");

const cupomPage = fs.readFileSync(
  path.join(root, "src/app/agendamento/cupom/[codigo]/page.tsx"),
  "utf8"
);
assert.match(cupomPage, /serviceNeedsStudioHours/);
assert.match(cupomPage, /PRODUCTION_SCHEDULE_DEFAULT_HOUR/);
assert.match(cupomPage, /\/api\/agendamentos\/com-cupom/);
pass("página exclusiva de cupom: hora só se o serviço exigir estúdio");

const dashboard = fs.readFileSync(
  path.join(root, "src/app/minha-conta/portal-ui/DashboardHome.tsx"),
  "utf8"
);
assert.match(dashboard, /Direitos disponíveis para agendar/);
assert.match(dashboard, /couponScheduleHref/);
pass("visão geral lista direitos com CTA Agendar");

console.log(JSON.stringify({ reportId: "scheduling-rights-domain-smoke", pass: true }, null, 2));
