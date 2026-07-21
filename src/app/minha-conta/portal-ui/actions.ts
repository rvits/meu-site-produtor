/**
 * Portal do Cliente (GO-03D) — ações do cliente.
 * Cada função chama exatamente o mesmo endpoint, método e payload que a
 * página Minha Conta original usava. Nenhuma API nova, nenhum contrato novo.
 */

type ActionResult = { ok: boolean; data: any };

async function post(url: string, body?: unknown): Promise<ActionResult> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function cancelarPlano(userPlanId: string): Promise<ActionResult> {
  return post("/api/planos/cancelar", { userPlanId });
}

export function solicitarReembolsoPlano(userPlanId: string): Promise<ActionResult> {
  return post("/api/planos/solicitar-reembolso", { userPlanId });
}

export async function excluirPlano(userPlanId: string): Promise<ActionResult> {
  const res = await fetch(
    `/api/planos/excluir?userPlanId=${encodeURIComponent(userPlanId)}`,
    { method: "DELETE" }
  );
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

export function processarPlanoAposPagamento(): Promise<ActionResult> {
  return fetch("/api/pagamentos/processar-plano-apos-pagamento", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
  }).then(async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) }));
}

export function vincularCuponsTeste(): Promise<ActionResult> {
  return fetch("/api/meus-dados/vincular-cupons-teste", { method: "POST" }).then(
    async (res) => ({ ok: res.ok, data: await res.json().catch(() => ({})) })
  );
}

export function renunciarCupom(couponId: string): Promise<ActionResult> {
  return post("/api/cupons/renunciar", { couponId });
}

export function escolherReembolso(
  appointmentId: number,
  opcao: "reembolso" | "cupom"
): Promise<ActionResult> {
  return post("/api/agendamentos/escolher-reembolso", { appointmentId, opcao });
}

export function cancelarAgendamento(
  appointmentId: number,
  refundType: "direct" | "coupon"
): Promise<ActionResult> {
  return post("/api/agendamentos/cancelar", { appointmentId, refundType });
}
