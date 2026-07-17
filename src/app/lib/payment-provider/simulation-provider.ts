/**
 * SimulationProvider — gateway virtual.
 * Produz os mesmos efeitos de domínio que o Asaas via processPaymentWebhook / SM.
 */
import { prisma } from "@/app/lib/prisma";
import { processPaymentWebhook } from "@/app/lib/process-payment-webhook";
import { refundPaymentStatus } from "@/app/lib/domain/workflow";
import { syncInboundRefundConfirmation } from "@/app/lib/payment-refund-sync";
import { REFUND_ASAAS_STATUS_SIMULATED } from "@/app/lib/symbolic-payment";
import type {
  CheckoutParams,
  CheckoutResponse,
  CreatePaymentParams,
  CreatePaymentResult,
  PaymentProvider,
  ProviderPaymentSnapshot,
  RefundPaymentResult,
  SimulateWebhookParams,
  SimulateWebhookResult,
} from "@/app/lib/payment-provider/types";

function newSimPaymentId(): string {
  return `sim_pay_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class SimulationProvider implements PaymentProvider {
  readonly kind = "simulation" as const;

  async createCheckout(params: CheckoutParams): Promise<CheckoutResponse> {
    const created = await this.createPayment(params);
    return {
      initPoint: created.initPoint || `/admin/homologacao?paymentId=${created.providerPaymentId}`,
      preferenceId: created.providerPaymentId,
      provider: "simulation",
    };
  }

  async createPayment(params: CreatePaymentParams): Promise<CreatePaymentResult> {
    const value =
      params.value ??
      params.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
    const providerPaymentId = newSimPaymentId();
    const operationId =
      typeof params.metadata?.operationId === "string" ? params.metadata.operationId : null;

    if (operationId) {
      await prisma.paymentMetadata.update({
        where: { id: operationId },
        data: { asaasId: providerPaymentId },
      });
    }

    return {
      providerPaymentId,
      provider: "simulation",
      status: "PENDING",
      value: Number(value.toFixed(2)),
      initPoint: `/admin/homologacao?paymentId=${encodeURIComponent(providerPaymentId)}`,
      invoiceUrl: undefined,
      raw: {
        id: providerPaymentId,
        status: "PENDING",
        value,
        billingType: "UNDEFINED",
        provider: "SIMULATION",
      },
    };
  }

  async confirmPayment(providerPaymentId: string): Promise<SimulateWebhookResult> {
    const meta = await prisma.paymentMetadata.findFirst({
      where: { asaasId: providerPaymentId },
    });
    let description = "Agendamento THouse Rec - simulação";
    let value = 0;
    let externalReference: string | undefined;
    if (meta) {
      externalReference = meta.id;
      try {
        const parsed = JSON.parse(meta.metadata || "{}") as Record<string, unknown>;
        value = Number(parsed.chargedAmount ?? parsed.total ?? 0) || 0;
        if (parsed.tipo === "plano") {
          description = `Plano ${String(parsed.planName || parsed.planId || "")}`.trim();
        } else {
          description = "Agendamento THouse Rec - simulação";
        }
      } catch {
        /* keep defaults */
      }
    }
    return this.simulateWebhook({
      providerPaymentId,
      event: "PAYMENT_RECEIVED",
      status: "RECEIVED",
      value,
      description,
      externalReference,
    });
  }

  async cancelPayment(providerPaymentId: string): Promise<ProviderPaymentSnapshot> {
    const local = await prisma.payment.findFirst({
      where: { asaasId: providerPaymentId },
    });
    if (local && !["refunded", "reembolsado"].includes(String(local.status).toLowerCase())) {
      await prisma.payment.update({
        where: { id: local.id },
        data: { status: "cancelled" },
      });
    }
    return {
      providerPaymentId,
      provider: "simulation",
      status: "CANCELLED",
      value: local?.amount ?? 0,
      description: null,
      refundStatus: null,
    };
  }

  async refundPayment(
    providerPaymentId: string,
    opts?: { value?: number; description?: string }
  ): Promise<RefundPaymentResult> {
    const local = await prisma.payment.findFirst({
      where: { asaasId: providerPaymentId },
    });
    if (!local) {
      return {
        status: "FAILED",
        providerPaymentId,
        provider: "simulation",
        reason: "Pagamento local não encontrado para reembolso simulado.",
      };
    }

    try {
      // Marca início do reembolso (espelha fluxo real antes do webhook Asaas)
      const now = new Date();
      if (local.appointmentId) {
        await prisma.appointment.updateMany({
          where: { id: local.appointmentId },
          data: {
            cancelRefundOption: "reembolso",
            refundProcessedAt: now,
            refundAsaasStatus: "pending",
          },
        });
      }
      await prisma.coupon.updateMany({
        where: { paymentId: local.id, refundProcessedAt: null },
        data: {
          refundRequestedAt: now,
          refundProcessedAt: now,
          refundAmount: opts?.value ?? local.amount,
          refundAsaasStatus: "pending",
        },
      });
      if (local.type === "plano") {
        await prisma.userPlan.updateMany({
          where: {
            userId: local.userId,
            ...(local.planId ? { planId: local.planId } : {}),
            refundProcessedAt: null,
          },
          data: {
            refundRequestedAt: now,
            refundProcessedAt: now,
            refundAmount: opts?.value ?? local.amount,
            refundAsaasStatus: "pending",
          },
        });
      }

      const sm = await refundPaymentStatus(local.id, {
        type: "system",
        id: "simulation-provider",
      });
      if (!sm.ok) {
        return {
          status: "FAILED",
          providerPaymentId,
          provider: "simulation",
          reason: sm.error || "Falha na State Machine ao reembolsar pagamento.",
          value: opts?.value ?? local.amount,
        };
      }

      const sync = await syncInboundRefundConfirmation(providerPaymentId);

      // Cupons simbólicos usam status simulated quando não há Asaas
      await prisma.coupon.updateMany({
        where: { paymentId: local.id, refundAsaasStatus: "confirmed" },
        data: { refundAsaasStatus: REFUND_ASAAS_STATUS_SIMULATED },
      });

      try {
        const { publishSyncEvent } = await import("@/app/lib/synchronization/engine");
        await publishSyncEvent({
          name: "PaymentRefunded",
          entity: "payment",
          entityId: local.id,
          to: "reembolsado",
          options: {
            source: "lifecycle",
            userId: local.userId,
            metadata: {
              provider: "SIMULATION",
              providerPaymentId,
              sync,
              description: opts?.description || "Reembolso simulado",
            },
          },
        });
      } catch {
        /* non-fatal */
      }

      return {
        status: "APPROVED",
        providerPaymentId,
        provider: "simulation",
        reason: "Reembolso simulado aprovado (pipeline oficial SM + sync).",
        value: opts?.value ?? local.amount,
        raw: { sync, paymentStatus: "refunded" },
      };
    } catch (e: unknown) {
      const reason = e instanceof Error ? e.message : String(e);
      return {
        status: "FAILED",
        providerPaymentId,
        provider: "simulation",
        reason,
        value: opts?.value ?? local.amount,
      };
    }
  }

  async simulateWebhook(params: SimulateWebhookParams): Promise<SimulateWebhookResult> {
    if (params.event === "PAYMENT_REFUNDED") {
      const refund = await this.refundPayment(params.providerPaymentId, {
        value: params.value,
      });
      return {
        received: true,
        success: refund.status === "APPROVED",
        error: refund.status === "FAILED" ? refund.reason : undefined,
        domainResult: refund,
      };
    }

    if (params.event !== "PAYMENT_RECEIVED" && params.event !== "PAYMENT_CONFIRMED") {
      return { received: true, success: false, error: `Evento ${params.event} não gera efeitos de confirmação.` };
    }

    const meta = await prisma.paymentMetadata.findFirst({
      where: { asaasId: params.providerPaymentId },
    });
    let value = params.value ?? 0;
    let description = params.description || "Agendamento THouse Rec - simulação";
    let externalReference = params.externalReference || meta?.id || undefined;
    if (meta && !params.value) {
      try {
        const parsed = JSON.parse(meta.metadata || "{}") as Record<string, unknown>;
        value = Number(parsed.chargedAmount ?? parsed.total ?? 0) || 0;
      } catch {
        /* ignore */
      }
    }

    const domainResult = await processPaymentWebhook({
      event: "PAYMENT_RECEIVED",
      payment: {
        id: params.providerPaymentId,
        status: params.status || "RECEIVED",
        value,
        netValue: value,
        billingType: "UNDEFINED",
        customer: "cus_simulation",
        externalReference,
        description,
        metadata: params.metadata || {},
      },
    });

    return {
      received: Boolean((domainResult as { received?: boolean })?.received),
      success: Boolean((domainResult as { success?: boolean })?.success),
      error: (domainResult as { error?: string })?.error,
      domainResult,
    };
  }

  async getPayment(providerPaymentId: string): Promise<ProviderPaymentSnapshot | null> {
    const local = await prisma.payment.findFirst({
      where: { asaasId: providerPaymentId },
    });
    if (local) {
      const st = String(local.status).toLowerCase();
      return {
        providerPaymentId,
        provider: "simulation",
        status:
          st === "refunded" || st === "reembolsado"
            ? "REFUNDED"
            : st === "approved" || st === "confirmado"
              ? "RECEIVED"
              : st === "cancelled" || st === "cancelado"
                ? "CANCELLED"
                : "PENDING",
        value: local.amount,
        description: null,
        refundStatus:
          st === "refunded" || st === "reembolsado" ? "APPROVED" : null,
        raw: local,
      };
    }
    const meta = await prisma.paymentMetadata.findFirst({
      where: { asaasId: providerPaymentId },
    });
    if (!meta) return null;
    let value = 0;
    try {
      const parsed = JSON.parse(meta.metadata || "{}") as Record<string, unknown>;
      value = Number(parsed.chargedAmount ?? parsed.total ?? 0) || 0;
    } catch {
      /* ignore */
    }
    return {
      providerPaymentId,
      provider: "simulation",
      status: "PENDING",
      value,
      externalReference: meta.id,
      refundStatus: null,
    };
  }
}
