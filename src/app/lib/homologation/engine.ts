/**
 * Homologation Engine — orquestra SimulationProvider + pipeline oficial.
 * Não cria Appointment/Service/Coupon diretamente: só via processPaymentWebhook.
 */
import { prisma } from "@/app/lib/prisma";
import { SimulationProvider } from "@/app/lib/payment-provider/simulation-provider";
import { SYMBOLIC_AGENDAMENTO_BRL } from "@/app/lib/symbolic-payment";
import { saveHomologationRun } from "@/app/lib/homologation/store";
import type {
  HomologationCheck,
  HomologationRun,
  HomologationRunInput,
  HomologationTimelineEvent,
} from "@/app/lib/homologation/types";
import { totalPricedCheckoutItems, priceCheckoutItems } from "@/app/lib/service-catalog";

function pushTimeline(
  timeline: HomologationTimelineEvent[],
  step: string,
  ok: boolean,
  detail?: string,
  data?: unknown
) {
  timeline.push({
    at: new Date().toISOString(),
    step,
    ok,
    detail,
    data,
  });
}

function emptyChecks(): HomologationCheck[] {
  return [
    { key: "paymentCreated", label: "Payment Created", ok: false },
    { key: "webhookExecuted", label: "Webhook Executed", ok: false },
    { key: "appointmentCreated", label: "Appointment Created", ok: false },
    { key: "servicesCreated", label: "Services Created", ok: false },
    { key: "couponsCreated", label: "Coupons Created", ok: false },
    { key: "refundRequested", label: "Refund Requested", ok: false },
    { key: "refundResolved", label: "Refund Approved / Failed", ok: false },
    { key: "workflowUpdated", label: "Workflow Updated", ok: false },
    { key: "minhaContaUpdated", label: "Minha Conta Updated", ok: false },
    { key: "dashboardUpdated", label: "Dashboard Updated", ok: false },
  ];
}

function mark(
  checks: HomologationCheck[],
  key: HomologationCheck["key"],
  ok: boolean,
  detail?: string
) {
  const row = checks.find((c) => c.key === key);
  if (row) {
    row.ok = ok;
    row.detail = detail;
  }
}

export async function runHomologationSimulation(
  input: HomologationRunInput
): Promise<HomologationRun> {
  const runId = `homo_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const timeline: HomologationTimelineEvent[] = [];
  const checks = emptyChecks();
  const provider = new SimulationProvider();
  const tipo = input.tipo || "agendamento";

  const run: HomologationRun = {
    runId,
    startedAt: new Date().toISOString(),
    provider: "SIMULATION",
    input,
    checks,
    timeline,
    ok: false,
  };

  try {
    pushTimeline(timeline, "start", true, `Homologação ${tipo} via SimulationProvider`);

    let metadata: Record<string, unknown>;
    let description: string;
    let chargedAmount = SYMBOLIC_AGENDAMENTO_BRL;

    if (tipo === "plano") {
      const planId = input.planId || "bronze";
      metadata = {
        tipo: "plano",
        userId: input.userId,
        planId,
        planName: `Plano ${planId}`,
        modo: input.modo || "mensal",
        amount: String(SYMBOLIC_AGENDAMENTO_BRL),
        chargedAmount: String(SYMBOLIC_AGENDAMENTO_BRL),
        symbolicPlano: true,
        isTestPayment: true,
        isTest: true,
        provider: "SIMULATION",
        homologationRunId: runId,
        billingDay: new Date().getDate(),
        paymentMethod: "pix",
      };
      description = `Plano ${planId} - simulação homologação`;
    } else {
      const servicos = input.servicos || [
        { id: "sessao", nome: "Sessão", quantidade: 1 },
      ];
      const beats = input.beats || [];
      let catalogTotal = 40;
      try {
        const ps = priceCheckoutItems(
          servicos.map((s) => ({ id: s.id, quantidade: s.quantidade })),
          "service"
        );
        const pb = priceCheckoutItems(
          beats.map((b) => ({ id: b.id, quantidade: b.quantidade })),
          "beat"
        );
        catalogTotal = totalPricedCheckoutItems([...ps, ...pb]);
      } catch {
        catalogTotal = 40;
      }
      metadata = {
        tipo: "agendamento",
        userId: input.userId,
        ...(input.data && input.hora ? { data: input.data, hora: input.hora } : {}),
        duracaoMinutos: input.duracaoMinutos || 60,
        tipoAgendamento: servicos[0]?.id || "sessao",
        observacoes: input.observacoes || `Homologação ${runId}`,
        servicos,
        beats,
        total: String(catalogTotal),
        chargedAmount: String(SYMBOLIC_AGENDAMENTO_BRL),
        paymentMethod: "pix",
        symbolicAgendamento: true,
        isTestPayment: true,
        provider: "SIMULATION",
        homologationRunId: runId,
      };
      description = "Agendamento THouse Rec - simulação homologação";
    }

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    const metaRow = await prisma.paymentMetadata.create({
      data: {
        userId: input.userId,
        metadata: JSON.stringify(metadata),
        expiresAt,
      },
    });
    pushTimeline(timeline, "paymentMetadata", true, metaRow.id);

    const created = await provider.createPayment({
      items: [
        {
          id: tipo === "plano" ? "homo-plano" : "homo-agendamento",
          title: description,
          quantity: 1,
          unit_price: chargedAmount,
        },
      ],
      payer: {
        name: input.userName,
        email: input.userEmail,
      },
      metadata: { operationId: metaRow.id },
      backUrls: {
        success: "/admin/homologacao",
        failure: "/admin/homologacao",
        pending: "/admin/homologacao",
      },
      description,
      value: chargedAmount,
    });
    run.providerPaymentId = created.providerPaymentId;
    mark(checks, "paymentCreated", true, created.providerPaymentId);
    pushTimeline(timeline, "createPayment", true, created.providerPaymentId, created);

    const webhook = await provider.confirmPayment(created.providerPaymentId);
    mark(
      checks,
      "webhookExecuted",
      Boolean(webhook.received),
      webhook.error || (webhook.success ? "PAYMENT_RECEIVED processado" : "recebido sem success")
    );
    pushTimeline(timeline, "confirmPayment/simulateWebhook", Boolean(webhook.success || webhook.received), webhook.error, webhook);

    const payment = await prisma.payment.findFirst({
      where: { asaasId: created.providerPaymentId },
    });
    if (!payment) {
      throw new Error("Payment local não criado após webhook simulado.");
    }
    run.paymentDbId = payment.id;
    mark(checks, "paymentCreated", true, `db=${payment.id} status=${payment.status}`);
    mark(
      checks,
      "workflowUpdated",
      ["approved", "confirmado"].includes(String(payment.status).toLowerCase()),
      `payment.status=${payment.status}`
    );

    const appointments = payment.appointmentId
      ? await prisma.appointment.findMany({ where: { id: payment.appointmentId } })
      : await prisma.appointment.findMany({
          where: {
            userId: input.userId,
            observacoes: { contains: runId },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        });

    // Carrinho/multi: appointmentIds no payment
    let aptIds: number[] = appointments.map((a) => a.id);
    if (payment.appointmentIds) {
      let raw: unknown = payment.appointmentIds;
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch {
          raw = null;
        }
      }
      if (Array.isArray(raw)) {
        aptIds = [...new Set([...aptIds, ...raw.map(Number).filter(Number.isFinite)])];
      }
    }
    if (payment.appointmentId) aptIds = [...new Set([...aptIds, payment.appointmentId])];

    run.appointmentIds = aptIds;
    mark(
      checks,
      "appointmentCreated",
      aptIds.length > 0 || tipo === "plano",
      aptIds.length > 0
        ? `ids=${aptIds.join(",")}`
        : tipo === "plano"
          ? "plano: appointment opcional (cupons de plano)"
          : "nenhum appointment (fluxo cupons-only esperado)"
    );
    // Coupons-only multi: ok even without appointment
    if (aptIds.length === 0 && tipo === "agendamento") {
      mark(checks, "appointmentCreated", true, "cupons-only: appointment no resgate");
    }

    const services =
      aptIds.length > 0
        ? await prisma.service.findMany({ where: { appointmentId: { in: aptIds } } })
        : [];
    run.serviceIds = services.map((s) => s.id);
    mark(
      checks,
      "servicesCreated",
      services.length > 0 || tipo === "plano" || aptIds.length === 0,
      services.length > 0
        ? `${services.length} service(s)`
        : "sem services nesta etapa (cupons/plano)"
    );

    const coupons = await prisma.coupon.findMany({
      where: { paymentId: payment.id },
      orderBy: { createdAt: "asc" },
    });
    run.couponCodes = coupons.map((c) => c.code);
    mark(
      checks,
      "couponsCreated",
      coupons.length > 0 || (aptIds.length > 0 && services.length > 0),
      coupons.length > 0
        ? `${coupons.length} cupom(ns): ${coupons.map((c) => c.code).join(", ")}`
        : aptIds.length > 0
          ? "agendamento direto sem cupons de linha (sessão isolada)"
          : "nenhum cupom"
    );

    // Sync surfaces: eventos publicados pelo webhook
    const syncEvents = await prisma.synchronizationEvent.count({
      where: {
        OR: [
          { entityId: payment.id },
          ...(aptIds.length ? [{ entityId: { in: aptIds.map(String) } }] : []),
        ],
      },
    });
    const history = await prisma.domainTransitionHistory.count({
      where: {
        OR: [
          { entityId: payment.id },
          ...(aptIds.length ? [{ entityId: { in: aptIds.map(String) } }] : []),
        ],
      },
    });
    mark(
      checks,
      "workflowUpdated",
      history > 0 || ["approved", "confirmado"].includes(String(payment.status).toLowerCase()),
      `history=${history} payment=${payment.status}`
    );
    mark(
      checks,
      "minhaContaUpdated",
      syncEvents > 0 || payment.status === "approved",
      `syncEvents=${syncEvents}`
    );
    mark(
      checks,
      "dashboardUpdated",
      syncEvents > 0 || payment.status === "approved",
      `surfaces atualizadas via SynchronizationEngine (${syncEvents} eventos)`
    );

    if (input.runRefund) {
      mark(checks, "refundRequested", true, "refundPayment() SimulationProvider");
      pushTimeline(timeline, "refundPayment:request", true);
      const refund = await provider.refundPayment(created.providerPaymentId, {
        description: `Homologação refund ${runId}`,
      });
      run.refund = { status: refund.status, reason: refund.reason };
      mark(
        checks,
        "refundResolved",
        refund.status === "APPROVED" || refund.status === "PENDING",
        `${refund.status}${refund.reason ? ` — ${refund.reason}` : ""}`
      );
      pushTimeline(
        timeline,
        "refundPayment:result",
        refund.status !== "FAILED",
        refund.reason,
        refund
      );

      const paymentAfter = await prisma.payment.findUnique({ where: { id: payment.id } });
      mark(
        checks,
        "workflowUpdated",
        String(paymentAfter?.status).toLowerCase() === "refunded" ||
          String(paymentAfter?.status).toLowerCase() === "reembolsado",
        `payment.status=${paymentAfter?.status}`
      );
    } else {
      mark(checks, "refundRequested", true, "não solicitado neste run");
      mark(checks, "refundResolved", true, "não solicitado neste run");
    }

    run.ok = checks
      .filter((c) => !["refundRequested", "refundResolved"].includes(c.key) || input.runRefund)
      .every((c) => {
        if (!input.runRefund && (c.key === "refundRequested" || c.key === "refundResolved")) {
          return true;
        }
        return c.ok;
      });

    // Core path must pass
    run.ok =
      checks.find((c) => c.key === "paymentCreated")!.ok &&
      checks.find((c) => c.key === "webhookExecuted")!.ok &&
      (coupons.length > 0 || aptIds.length > 0 || tipo === "plano") &&
      (!input.runRefund || run.refund?.status === "APPROVED" || run.refund?.status === "PENDING");

    pushTimeline(timeline, "finish", run.ok, run.ok ? "PASS" : "FAIL parcial");
  } catch (e: unknown) {
    run.error = e instanceof Error ? e.message : String(e);
    run.ok = false;
    pushTimeline(timeline, "error", false, run.error);
  }

  run.finishedAt = new Date().toISOString();
  await saveHomologationRun(run);
  return run;
}
