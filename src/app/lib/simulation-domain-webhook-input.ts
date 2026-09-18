/**
 * Payload de simulação → processPaymentWebhook.
 * Isolado do SimulationProvider para testes sem Prisma.
 * Não reescreve PAYMENT_CONFIRMED em PAYMENT_RECEIVED.
 */
export function simulationDomainWebhookInput(params: {
  event: string;
  status?: string;
  providerPaymentId: string;
  value: number;
  description: string;
  externalReference?: string;
  metadata?: Record<string, unknown>;
}): { event: string; payment: Record<string, unknown> } {
  const event = String(params.event);
  const status = String(
    params.status ||
      (event === "PAYMENT_CONFIRMED" ? "CONFIRMED" : "RECEIVED")
  );
  return {
    event,
    payment: {
      id: params.providerPaymentId,
      status,
      value: params.value,
      netValue: params.value,
      billingType: "UNDEFINED",
      customer: "cus_simulation",
      externalReference: params.externalReference,
      description: params.description,
      metadata: { ...(params.metadata || {}), provider: "SIMULATION" },
    },
  };
}
