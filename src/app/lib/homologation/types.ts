import type { RefundLifecycleStatus } from "@/app/lib/payment-provider/types";
import type { HomologationScenarioId } from "@/app/lib/homologation/scenarios";

export type HomologationCheckKey =
  | "paymentCreated"
  | "webhookExecuted"
  | "appointmentCreated"
  | "servicesCreated"
  | "couponsCreated"
  | "refundRequested"
  | "refundResolved"
  | "workflowUpdated"
  | "minhaContaUpdated"
  | "dashboardUpdated";

export type HomologationCheck = {
  key: HomologationCheckKey;
  label: string;
  ok: boolean;
  detail?: string;
};

export type HomologationTimelineEvent = {
  at: string;
  step: string;
  ok: boolean;
  detail?: string;
  data?: unknown;
};

export type HomologationRunInput = {
  userId: string;
  userEmail: string;
  userName: string;
  scenarioId?: HomologationScenarioId | string;
  scenarioKind?: "cupom_desconto" | "cupom_remarcacao";
  tipo?: "agendamento" | "plano";
  servicos?: { id: string; nome?: string; quantidade: number; preco?: number }[];
  beats?: { id: string; nome?: string; quantidade: number; preco?: number }[];
  data?: string;
  hora?: string;
  duracaoMinutos?: number;
  observacoes?: string;
  planId?: string;
  modo?: "mensal" | "anual";
  runRefund?: boolean;
  refundOutcome?: RefundLifecycleStatus;
  expectedServiceCoupons?: number | null;
};

export type HomologationRun = {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  provider: "SIMULATION";
  scenarioId?: string;
  input: HomologationRunInput;
  providerPaymentId?: string;
  paymentDbId?: string;
  appointmentIds?: number[];
  serviceIds?: string[];
  couponCodes?: string[];
  refund?: {
    status: RefundLifecycleStatus;
    reason?: string;
  };
  checks: HomologationCheck[];
  timeline: HomologationTimelineEvent[];
  ok: boolean;
  error?: string;
};
