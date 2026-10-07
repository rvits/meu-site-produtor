/**
 * Invariantes da compensação administrativa e do reembolso sem fallback temporal.
 * Não acessa banco, Asaas nem Production.
 */
import fs from "node:fs";
import path from "node:path";
import { canDeleteClosedAppointment } from "../src/app/lib/appointment-delete-gate";
import {
  classifyCartItem,
  decideCartPartialRefund,
} from "../src/app/lib/cart-partial-refund-decision";
import {
  ADMIN_MANUAL_COMPENSATION_LABEL,
  CLIENT_MANUAL_COMPENSATION_LABEL,
  adminResolutionLabel,
  appointmentReopenResolutionClear,
  clientRefundChoiceVisible,
  clientResolutionLabel,
  decideManualCompensation,
  omitManualCompensationAudit,
  parseManualCompensationReason,
} from "../src/app/lib/manual-compensation";

const root = process.cwd();
let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`ok  ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}${detail ? ` — ${detail}` : ""}`);
}

function read(rel: string): string {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) return "";
  return source.slice(from, to);
}

check(
  "1 recusado sem opção continua elegível",
  clientRefundChoiceVisible({ status: "recusado", cancelRefundOption: null })
);
check(
  "2 cancelado sem opção continua elegível",
  clientRefundChoiceVisible({ status: "cancelado", cancelRefundOption: null })
);
check(
  "3 manual não oferece escolha",
  !clientRefundChoiceVisible({ status: "recusado", cancelRefundOption: "manual" }) &&
    !clientRefundChoiceVisible({ status: "cancelado", cancelRefundOption: "manual" }) &&
    clientResolutionLabel("manual") === CLIENT_MANUAL_COMPENSATION_LABEL
);

const escolher = read("src/app/api/agendamentos/escolher-reembolso/route.ts");
const guardAt = escolher.indexOf("isManualCompensation(agendamento.cancelRefundOption)");
const paymentAt = escolher.indexOf("prisma.payment.findFirst");
const couponCreateAt = escolher.indexOf("createDomainCoupon(");
check("4-5 guarda manual existe antes de pagamento e cupom", guardAt > 0 && guardAt < paymentAt && guardAt < couponCreateAt);
check(
  "4-5 resposta administrativa explícita",
  escolher.includes("Esta solicitação já foi compensada administrativamente.")
);

const adminRoute = read("src/app/api/admin/agendamentos/compensacao-manual/route.ts");
check("6 marcar manual não cria Coupon", !adminRoute.includes("createDomainCoupon") && !adminRoute.includes("prisma.coupon"));
check("7 marcar manual não altera Payment", !adminRoute.includes("prisma.payment"));
check(
  "8 marcar manual não chama Asaas",
  !adminRoute.includes("asaas") && !adminRoute.includes("refundAsaas") && !adminRoute.includes("listAsaas")
);
check(
  "6-8 não preenche trilha financeira",
  !adminRoute.includes("refundCouponId") &&
    !adminRoute.includes("refundProcessedAt") &&
    !adminRoute.includes("refundAsaasStatus")
);
check("endpoint exige admin e update condicional", adminRoute.includes("requireAdmin()") && adminRoute.includes("cancelRefundOption: null"));

check(
  "9 segunda execução não sobrescreve manual",
  decideManualCompensation({
    updatedCount: 0,
    appointment: { status: "recusado", cancelRefundOption: "manual" },
  }).outcome === "already_manual"
);
check(
  "10 cupom não vira manual",
  decideManualCompensation({
    updatedCount: 0,
    appointment: { status: "cancelado", cancelRefundOption: "cupom" },
  }).outcome === "conflict"
);
check(
  "10 reembolso não vira manual",
  decideManualCompensation({
    updatedCount: 0,
    appointment: { status: "recusado", cancelRefundOption: "reembolso" },
  }).outcome === "conflict"
);
const blankReason = parseManualCompensationReason("  ");
check(
  "motivo longo é rejeitado e vazio vira nulo",
  !parseManualCompensationReason("x".repeat(501)).ok &&
    blankReason.ok &&
    blankReason.reason === null
);

check("11 não lista cobranças Asaas para adivinhar", !escolher.includes("listAsaasPaymentsReceived"));
check("12 nenhuma cobrança é escolhida por ±48h", !escolher.includes("twoDaysMs") && !escolher.includes("48 * 60"));
check("não cria Payment por heurística", !escolher.includes("prisma.payment.create"));

const linked = decideCartPartialRefund({
  paymentAmount: 80,
  appointmentIds: [50],
  appointmentId: 50,
  items: null,
  alreadyRefunded: 0,
  link: "direct",
});
check("13 pagamento ligado continua elegível", linked.blocked === null && linked.amount === 80);

const metadataItem = decideCartPartialRefund({
  paymentAmount: 80,
  appointmentIds: [50],
  appointmentId: 50,
  items: [{ total: 80, aggregate: false }],
  alreadyRefunded: 0,
  link: "direct",
});
check("14 item atômico com vínculo determinístico", metadataItem.blocked === null && metadataItem.amount === 80 && metadataItem.source === "metadata");
check(
  "metadata appointmentId continua no fluxo",
  escolher.includes("parsed.appointmentId") && escolher.includes('paymentLink = "direct"')
);

const bundle = classifyCartItem({
  total: 225,
  servicos: [
    { id: "captacao", quantidade: 1, preco: 55 },
    { id: "mix_master", quantidade: 1, preco: 170 },
  ],
});
const bundleDecision = decideCartPartialRefund({
  paymentAmount: 225,
  appointmentIds: [50],
  appointmentId: 50,
  items: [bundle],
  alreadyRefunded: 0,
  link: "direct",
});
const splitDecision = decideCartPartialRefund({
  paymentAmount: 225,
  appointmentIds: [49, 50],
  appointmentId: 50,
  items: [
    { total: 55, aggregate: false },
    { total: 170, aggregate: true },
  ],
  alreadyRefunded: 0,
  link: "direct",
});
const unlinked = decideCartPartialRefund({
  paymentAmount: 225,
  appointmentIds: [],
  appointmentId: 50,
  items: [{ total: 225, aggregate: false }],
  alreadyRefunded: 0,
  link: "direct",
});
check("15 pacote agregado não gera refund", bundle.aggregate && bundleDecision.blocked === "aggregate" && bundleDecision.amount === 0);
check("15 mix_master não atribui o valor do pacote ao master", splitDecision.blocked === "aggregate" && splitDecision.amount === 0);
check("pagamento sem vínculo não entra no cálculo", unlinked.blocked === "unlinked" && unlinked.amount === 0);

const atomicCart = decideCartPartialRefund({
  paymentAmount: 135,
  appointmentIds: [60, 61],
  appointmentId: 61,
  items: [
    { total: 55, aggregate: false },
    { total: 80, aggregate: false },
  ],
  alreadyRefunded: 0,
  link: "direct",
});
check("carrinho 1:1 atômico continua reembolsando só o item", atomicCart.blocked === null && atomicCart.amount === 80);

const equalSplit = decideCartPartialRefund({
  paymentAmount: 135,
  appointmentIds: [60, 61],
  appointmentId: 61,
  items: null,
  alreadyRefunded: 0,
  link: "direct",
});
check("sem itens não há rateio igualitário", equalSplit.blocked === "no_item_split" && equalSplit.amount === 0);

const couponRootBundle = decideCartPartialRefund({
  paymentAmount: 225,
  appointmentIds: [],
  appointmentId: 53,
  items: [bundle],
  alreadyRefunded: 0,
  link: "coupon_root",
});
check("pedido raiz de cupom com pacote não gera refund", couponRootBundle.blocked === "aggregate" && couponRootBundle.amount === 0);

check(
  "16 reabertura limpa compensação manual junto com a resolução",
  appointmentReopenResolutionClear.cancelRefundOption === null &&
    appointmentReopenResolutionClear.manualCompensationAt === null &&
    appointmentReopenResolutionClear.manualCompensationBy === null &&
    appointmentReopenResolutionClear.manualCompensationReason === null &&
    read("src/app/lib/domain/state-machine/transition.ts").includes("appointmentReopenResolutionClear")
);

const portalCard = read("src/app/minha-conta/portal-ui/AppointmentCard.tsx");
const timeline = read("src/app/minha-conta/portal-ui/OrderTimeline.tsx");
const history = read("src/app/minha-conta/portal-ui/HistorySection.tsx");
const meusDados = read("src/app/api/meus-dados/route.ts");
check(
  "17 Minha Conta não chama manual de cupom nem de reembolso",
  portalCard.includes(CLIENT_MANUAL_COMPENSATION_LABEL) &&
    timeline.includes(CLIENT_MANUAL_COMPENSATION_LABEL) &&
    history.includes(CLIENT_MANUAL_COMPENSATION_LABEL) &&
    !between(timeline, 'cancelRefundOption === "manual"', "} else {").includes("Cupom") &&
    !between(timeline, 'cancelRefundOption === "manual"', "} else {").includes("Reembolso direto") &&
    meusDados.includes("omitManualCompensationAudit")
);
const stripped = omitManualCompensationAudit({
  id: 1,
  cancelRefundOption: "manual",
  manualCompensationAt: "2026-10-02",
  manualCompensationBy: "admin",
  manualCompensationReason: "interno",
});
check(
  "17 motivo administrativo não vai para o cliente",
  !("manualCompensationReason" in stripped) &&
    !("manualCompensationBy" in stripped) &&
    stripped.cancelRefundOption === "manual"
);

const drawer = read("src/app/admin/agendamentos-ui/AppointmentDrawer.tsx");
const card = read("src/app/admin/agendamentos-ui/AppointmentCard.tsx");
const adminTimeline = read("src/app/admin/agendamentos-ui/AppointmentTimeline.tsx");
check(
  "18 admin não chama manual de cupom",
  adminResolutionLabel("manual") === ADMIN_MANUAL_COMPENSATION_LABEL &&
    adminResolutionLabel("manual") !== "Cupom de remarcação" &&
    drawer.includes("adminResolutionLabel") &&
    !drawer.includes('? "Reembolso direto (Asaas)" : "Cupom de remarcação"') &&
    card.includes("ADMIN_MANUAL_COMPENSATION_LABEL") &&
    adminTimeline.includes("ADMIN_MANUAL_COMPENSATION_LABEL") &&
    card.includes("Marcar como compensado manualmente") &&
    drawer.includes("Marcar como compensado manualmente")
);

const gate = canDeleteClosedAppointment({
  status: "recusado",
  cancelRefundOption: "manual",
});
check(
  "delete gate preserva o histórico e não apaga",
  gate.allowed === false && gate.reason.includes("Compensação administrativa")
);
check(
  "recusado sem opção continua não apagável",
  canDeleteClosedAppointment({ status: "recusado", cancelRefundOption: null }).allowed === false
);

const migration = read("prisma/migrations/20261002080000_appointment_manual_compensation/migration.sql");
check(
  "migration só adiciona colunas nullable",
  migration.includes('ADD COLUMN IF NOT EXISTS "manualCompensationAt"') &&
    migration.includes('ADD COLUMN IF NOT EXISTS "manualCompensationBy"') &&
    migration.includes('ADD COLUMN IF NOT EXISTS "manualCompensationReason"') &&
    !/UPDATE|DELETE|DROP/i.test(migration)
);

if (failed > 0) {
  console.error(`\n${failed} verificação(ões) falharam.`);
  process.exit(1);
}
console.log("\ncompensação manual: invariantes ok");
