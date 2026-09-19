/**
 * ETAPA 6 — /pagamentos/sucesso sem redirect automático (sem banco, sem Asaas).
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "path";

function pass(label: string) {
  console.log("PASS", label);
}

const root = path.resolve(__dirname, "..");
const sucesso = fs.readFileSync(
  path.join(root, "src/app/pagamentos/sucesso/page.tsx"),
  "utf8"
);
const portal = fs.readFileSync(
  path.join(root, "src/app/minha-conta/portal-ui/ClientPortal.tsx"),
  "utf8"
);
const tabs = fs.readFileSync(path.join(root, "src/app/minha-conta/portal-ui/tabs.ts"), "utf8");
const webhook = fs.readFileSync(path.join(root, "src/app/api/webhooks/asaas/route.ts"), "utf8");
const recover = fs.readFileSync(
  path.join(root, "src/app/lib/recover-confirmed-asaas-payment.ts"),
  "utf8"
);
const checkoutCart = fs.readFileSync(
  path.join(root, "src/app/api/asaas/checkout-carrinho/route.ts"),
  "utf8"
);

{
  assert.doesNotMatch(sucesso, /window\.location\.href\s*=\s*["']\/minha-conta["']/);
  assert.doesNotMatch(sucesso, /router\.(push|replace)\(\s*["']\/minha-conta/);
  pass("CASO 1 sem redirect automático para Minha Conta");
}

{
  assert.doesNotMatch(
    sucesso,
    /setTimeout\(\s*\(\)\s*=>\s*\{\s*window\.location\.href/
  );
  assert.doesNotMatch(sucesso, /Redirecionando para/);
  pass("CASO 2 sem timeout/countdown de redirect");
}

{
  assert.match(sucesso, /Ver meus serviços e agendar/);
  assert.match(sucesso, /LinkButton href=\{MINHA_CONTA_POS_PAGAMENTO_HREF\}/);
  pass("CASO 3 CTA principal existe");
}

{
  assert.match(sucesso, /\/minha-conta\?tab=visao-geral/);
  assert.match(tabs, /"visao-geral"/);
  assert.match(portal, /tabParam = searchParams\.get\("tab"\)/);
  assert.match(portal, /isTabKey\(tabParam\) \? tabParam : "visao-geral"/);
  pass("CASO 4 CTA aponta para tab real visao-geral");
}

{
  assert.doesNotMatch(sucesso, /Obrigado por agendar/);
  assert.doesNotMatch(sucesso, /agendamento foi confirmado/i);
  assert.doesNotMatch(sucesso, /confirmação do agendamento/);
  assert.doesNotMatch(sucesso, /Sua sessão foi agendada/);
  pass("CASO 5 copy não afirma agendamento confirmado");
}

{
  assert.match(sucesso, /ainda não possuem data e horário podem ser agendados/);
  pass("CASO 6 copy cobre pending-rights");
}

{
  assert.match(sucesso, /Se já[\s\S]*houver um horário definido/);
  pass("CASO 7 copy cobre compra já agendada sem inferir o caso");
}

{
  assert.doesNotMatch(sucesso, /method:\s*["']POST["']/);
  assert.doesNotMatch(sucesso, /processPaymentWebhook|recover-confirmed|checkout-carrinho/);
  assert.match(sucesso, /\/api\/pagamentos\/verificar\?operationId=/);
  pass("CASO 8/9 refresh/página só lê verificar; sem cobrança/recovery");
}

{
  assert.match(sucesso, /tipo === "plano"/);
  assert.match(sucesso, /plano e os serviços do seu ciclo/);
  assert.doesNotMatch(sucesso, /Plano ativado com sucesso[\s\S]*agendamento/);
  pass("CASO 10 fluxo de plano sem mensagem de sessão agendada");
}

{
  assert.match(checkoutCart, /pagamentos\/sucesso\?tipo=agendamento/);
  assert.doesNotMatch(webhook, /pagamentos\/sucesso/);
  assert.doesNotMatch(recover, /pagamentos\/sucesso/);
  pass("isolamento: checkout aponta para sucesso; webhook/recovery não");
}

{
  assert.match(portal, /loginHrefWithInternalReturn/);
  assert.match(portal, /\/minha-conta\?\$\{qs\}/);
  assert.doesNotMatch(portal, /router\.push\(["']\/login["']\)/);
  pass("CASO 11 Minha Conta preserva return-to no login");
}

console.log(JSON.stringify({ reportId: "payment-success-ux-smoke", pass: true }, null, 2));
