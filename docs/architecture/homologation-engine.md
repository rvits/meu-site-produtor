# Homologation Engine — regra permanente (OP-02H / OP-02B)

## H1 — Cobertura obrigatória

Toda funcionalidade futura que altere **pagamentos**, **workflow**, **agendamento**, **planos**, **cupons** ou **reembolso** deve possuir cenário correspondente executável no Homologation Engine.

- Catálogo: `src/app/lib/homologation/scenarios.ts`
- Painel: `/admin/homologacao`
- API: `POST /api/admin/homologation/run` com `{ scenarioId }`
- Provider: `SimulationProvider` (mesmo domínio que Asaas — sem forks)

**Proibido:** criar fluxos paralelos ou regras “só para simulação”.

## Identidade multi-gateway (prep. v1.1)

- `Payment.provider` + `Payment.providerPaymentId` são canônicos.
- Simulation **não** grava em `Payment.asaasId`.
- Asaas dual-write `asaasId` + `providerPaymentId` até unificação v1.1.
- Lookups: `paymentByProviderIdWhere()` (`src/app/lib/payment-provider/identity.ts`).

## Refund Simulation

Outcomes suportados: `APPROVED` | `PENDING` | `FAILED` | `TIMEOUT`.
Todos atualizam entidades locais + sync events + timeline do run.
