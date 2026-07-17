import type { RefundLifecycleStatus } from "@/app/lib/payment-provider/types";

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
  tipo?: "agendamento" | "plano";
  /** Agendamento */
  servicos?: { id: string; nome?: string; quantidade: number; preco?: number }[];
  beats?: { id: string; nome?: string; quantidade: number; preco?: number }[];
  data?: string;
  hora?: string;
  duracaoMinutos?: number;
  observacoes?: string;
  /** Plano */
  planId?: string;
  modo?: "mensal" | "anual";
  /** Após criar, executar reembolso simulado */
  runRefund?: boolean;
};

export type HomologationRun = {
  runId: string;
  startedAt: string;
  finishedAt?: string;
  provider: "SIMULATION";
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
