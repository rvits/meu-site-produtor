/**
 * Catálogo de cenários Homologation Engine (OP-02B).
 * Cada cenário mapeia para input de runHomologationSimulation.
 */
import type { HomologationRunInput } from "@/app/lib/homologation/types";
import type { RefundLifecycleStatus } from "@/app/lib/payment-provider/types";

export type HomologationScenarioId =
  | "sessao"
  | "beat"
  | "sessao_beat"
  | "plano_bronze"
  | "plano_prata"
  | "plano_ouro"
  | "cupom_desconto"
  | "cupom_remarcacao"
  | "refund_approved"
  | "refund_failed"
  | "refund_pending"
  | "refund_timeout";

export type HomologationScenarioDef = {
  id: HomologationScenarioId;
  label: string;
  description: string;
  /** Cupons de serviço esperados após confirm (null = não aplica / variável) */
  expectedServiceCoupons?: number | null;
  refundOutcome?: RefundLifecycleStatus;
  buildInput: (
    base: Pick<HomologationRunInput, "userId" | "userEmail" | "userName">
  ) => HomologationRunInput;
};

function tomorrowIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const HOMOLOGATION_SCENARIOS: HomologationScenarioDef[] = [
  {
    id: "sessao",
    label: "Sessão",
    description: "Uma sessão agendável → Appointment + Service (pipeline oficial).",
    expectedServiceCoupons: 0,
    buildInput: (base) => ({
      ...base,
      tipo: "agendamento",
      servicos: [{ id: "sessao", nome: "Sessão", quantidade: 1 }],
      beats: [],
      data: tomorrowIsoDate(),
      hora: "14:00",
      duracaoMinutos: 60,
      observacoes: "Homologação cenário sessão",
      runRefund: false,
    }),
  },
  {
    id: "beat",
    label: "Beat",
    description: "1 Beat → cupom TEST de serviço (página exclusiva).",
    expectedServiceCoupons: 1,
    buildInput: (base) => ({
      ...base,
      tipo: "agendamento",
      servicos: [],
      beats: [{ id: "beat1", nome: "1 Beat", quantidade: 1 }],
      observacoes: "Homologação cenário beat",
      runRefund: false,
    }),
  },
  {
    id: "sessao_beat",
    label: "Sessão + Beat",
    description: "Multi → dois cupons TEST independentes (sessao + beat1).",
    expectedServiceCoupons: 2,
    buildInput: (base) => ({
      ...base,
      tipo: "agendamento",
      servicos: [{ id: "sessao", nome: "Sessão", quantidade: 1 }],
      beats: [{ id: "beat1", nome: "1 Beat", quantidade: 1 }],
      observacoes: "Homologação cenário sessão+beat",
      runRefund: false,
    }),
  },
  {
    id: "plano_bronze",
    label: "Plano Bronze",
    description: "Pagamento simbólico de plano Bronze.",
    expectedServiceCoupons: null,
    buildInput: (base) => ({
      ...base,
      tipo: "plano",
      planId: "bronze",
      modo: "mensal",
      runRefund: false,
    }),
  },
  {
    id: "plano_prata",
    label: "Plano Prata",
    description: "Pagamento simbólico de plano Prata.",
    expectedServiceCoupons: null,
    buildInput: (base) => ({
      ...base,
      tipo: "plano",
      planId: "prata",
      modo: "mensal",
      runRefund: false,
    }),
  },
  {
    id: "plano_ouro",
    label: "Plano Ouro",
    description: "Pagamento simbólico de plano Ouro.",
    expectedServiceCoupons: null,
    buildInput: (base) => ({
      ...base,
      tipo: "plano",
      planId: "ouro",
      modo: "mensal",
      runRefund: false,
    }),
  },
  {
    id: "cupom_desconto",
    label: "Cupom Desconto",
    description: "Cria cupom DISCOUNT via domínio + valida checkoutDiscount.",
    expectedServiceCoupons: null,
    buildInput: (base) => ({
      ...base,
      tipo: "agendamento",
      scenarioKind: "cupom_desconto",
      servicos: [{ id: "sessao", nome: "Sessão", quantidade: 1 }],
      data: tomorrowIsoDate(),
      hora: "15:00",
      runRefund: false,
    }),
  },
  {
    id: "cupom_remarcacao",
    label: "Cupom Remarcação",
    description: "Fluxo cancel → REBOOK (página exclusiva).",
    expectedServiceCoupons: 1,
    buildInput: (base) => ({
      ...base,
      tipo: "agendamento",
      scenarioKind: "cupom_remarcacao",
      servicos: [{ id: "sessao", nome: "Sessão", quantidade: 1 }],
      data: tomorrowIsoDate(),
      hora: "16:00",
      runRefund: false,
    }),
  },
  {
    id: "refund_approved",
    label: "Refund APPROVED",
    description: "Reembolso simulado aprovado (pipeline SM + sync).",
    expectedServiceCoupons: 1,
    refundOutcome: "APPROVED",
    buildInput: (base) => ({
      ...base,
      tipo: "agendamento",
      servicos: [],
      beats: [{ id: "beat1", nome: "1 Beat", quantidade: 1 }],
      runRefund: true,
      refundOutcome: "APPROVED",
    }),
  },
  {
    id: "refund_failed",
    label: "Refund FAILED",
    description: "Reembolso simulado com falha controlada.",
    expectedServiceCoupons: 1,
    refundOutcome: "FAILED",
    buildInput: (base) => ({
      ...base,
      tipo: "agendamento",
      servicos: [],
      beats: [{ id: "beat1", nome: "1 Beat", quantidade: 1 }],
      runRefund: true,
      refundOutcome: "FAILED",
    }),
  },
  {
    id: "refund_pending",
    label: "Refund PENDING",
    description: "Reembolso solicitado e pendente (sem confirmação).",
    expectedServiceCoupons: 1,
    refundOutcome: "PENDING",
    buildInput: (base) => ({
      ...base,
      tipo: "agendamento",
      servicos: [],
      beats: [{ id: "beat1", nome: "1 Beat", quantidade: 1 }],
      runRefund: true,
      refundOutcome: "PENDING",
    }),
  },
  {
    id: "refund_timeout",
    label: "Refund TIMEOUT",
    description: "Reembolso com timeout simulado (gateway não respondeu).",
    expectedServiceCoupons: 1,
    refundOutcome: "TIMEOUT",
    buildInput: (base) => ({
      ...base,
      tipo: "agendamento",
      servicos: [],
      beats: [{ id: "beat1", nome: "1 Beat", quantidade: 1 }],
      runRefund: true,
      refundOutcome: "TIMEOUT",
    }),
  },
];

export function getHomologationScenario(
  id: string | null | undefined
): HomologationScenarioDef | undefined {
  if (!id) return undefined;
  return HOMOLOGATION_SCENARIOS.find((s) => s.id === id);
}
