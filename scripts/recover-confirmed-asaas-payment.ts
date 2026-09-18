/**
 * Recovery controlado de cobrança Asaas já CONFIRMADA.
 * Default: --dry-run (somente SELECT + plano). Nunca cria checkout.
 *
 * npx tsx --tsconfig tsconfig.json scripts/recover-confirmed-asaas-payment.ts \
 *   --operation-id <uuid> --asaas-id pay_... --expected-amount 225
 *
 * Execução real exige --execute (proibido nesta etapa 3C).
 */
import { prisma } from "@/app/lib/prisma";
import { processPaymentWebhook } from "@/app/lib/process-payment-webhook";
import {
  buildConfirmedRecoveryWebhookBody,
  metadataAmount,
  parseCarrinhoMetadataItems,
  planConfirmedAsaasPaymentRecovery,
  sanitizeCarrinhoMetadataForLog,
  scheduledCarrinhoItems,
} from "@/app/lib/recover-confirmed-asaas-payment";
import { paymentByProviderIdWhere } from "@/app/lib/payment-provider/identity";

function mask(id: string | null | undefined): string | null {
  if (!id) return null;
  const s = String(id);
  if (s.length <= 10) return `${s.slice(0, 2)}…`;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(name);
  if (idx < 0) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

function parseMetadata(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

async function main() {
  const execute = hasFlag("--execute");
  const dryRun = !execute;
  const operationId = arg("--operation-id")?.trim();
  const expectedAsaasId = arg("--asaas-id")?.trim();
  const expectedAmount = Number(arg("--expected-amount"));

  if (!operationId || !expectedAsaasId || !Number.isFinite(expectedAmount)) {
    console.error(
      JSON.stringify({
        ok: false,
        abort: "ARGS",
        usage:
          "--operation-id <uuid> --asaas-id pay_... --expected-amount 225 [--dry-run]",
      })
    );
    process.exit(1);
  }

  const row = await prisma.paymentMetadata.findUnique({
    where: { id: operationId },
    select: { id: true, asaasId: true, metadata: true, createdAt: true, expiresAt: true },
  });
  const metadata = row ? parseMetadata(row.metadata) : null;
  const existing = expectedAsaasId
    ? await prisma.payment.findFirst({
        where: paymentByProviderIdWhere(expectedAsaasId),
        select: { id: true, status: true, amount: true, appointmentId: true },
      })
    : null;

  const userId =
    metadata && typeof metadata.userId === "string" ? metadata.userId : null;
  const scheduled = metadata ? scheduledCarrinhoItems(parseCarrinhoMetadataItems(metadata)) : [];
  const scheduleAnchor = scheduled[0]?.data
    ? new Date(`${scheduled[0].data}T00:00:00`)
    : row?.createdAt
      ? new Date(row.createdAt)
      : null;
  const windowStart = scheduleAnchor
    ? new Date(scheduleAnchor.getTime() - 24 * 60 * 60 * 1000)
    : null;
  const windowEnd = scheduleAnchor
    ? new Date(scheduleAnchor.getTime() + 2 * 24 * 60 * 60 * 1000)
    : null;

  const relatedAppointments =
    userId && windowStart && windowEnd
      ? await prisma.appointment.findMany({
          where: {
            userId,
            data: { gte: windowStart, lt: windowEnd },
          },
          select: { id: true },
        })
      : [];
  const relatedAppointmentIds = relatedAppointments.map((a) => a.id);
  const relatedServiceCount =
    relatedAppointmentIds.length > 0
      ? await prisma.service.count({ where: { appointmentId: { in: relatedAppointmentIds } } })
      : 0;
  const relatedCouponCount = existing?.id
    ? await prisma.coupon.count({ where: { paymentId: existing.id } })
    : 0;
  const relatedOrderCount = existing?.id
    ? await prisma.serviceOrder.count({ where: { paymentId: existing.id } })
    : 0;

  const countsBefore = {
    paymentMetadata: row ? 1 : 0,
    payment: existing ? 1 : 0,
    appointmentInWindow: relatedAppointmentIds.length,
    serviceLinkedToWindowAppointments: relatedServiceCount,
    couponByPayment: relatedCouponCount,
    serviceOrderByPayment: relatedOrderCount,
  };

  const plan = planConfirmedAsaasPaymentRecovery({
    operationId,
    expectedAsaasId,
    expectedAmount,
    metadata,
    storedAsaasId: row?.asaasId ?? null,
    existingPaymentId: existing?.id ?? null,
  });

  const webhook = buildConfirmedRecoveryWebhookBody({
    asaasPaymentId: expectedAsaasId,
    operationId,
    value: expectedAmount,
  });

  let countsAfterDryRun = countsBefore;
  if (dryRun) {
    const metaAfter = await prisma.paymentMetadata.count({ where: { id: operationId } });
    const payAfter = expectedAsaasId
      ? await prisma.payment.count({ where: paymentByProviderIdWhere(expectedAsaasId) })
      : 0;
    const apptsAfter =
      userId && windowStart && windowEnd
        ? await prisma.appointment.count({
            where: { userId, data: { gte: windowStart, lt: windowEnd } },
          })
        : 0;
    const apptIdsAfter =
      userId && windowStart && windowEnd
        ? (
            await prisma.appointment.findMany({
              where: { userId, data: { gte: windowStart, lt: windowEnd } },
              select: { id: true },
            })
          ).map((a) => a.id)
        : [];
    const svcAfter =
      apptIdsAfter.length > 0
        ? await prisma.service.count({ where: { appointmentId: { in: apptIdsAfter } } })
        : 0;
    countsAfterDryRun = {
      paymentMetadata: metaAfter,
      payment: payAfter,
      appointmentInWindow: apptsAfter,
      serviceLinkedToWindowAppointments: svcAfter,
      couponByPayment: relatedCouponCount,
      serviceOrderByPayment: relatedOrderCount,
    };
  }

  console.log(
    JSON.stringify(
      {
        mode: dryRun ? "dry-run" : "execute",
        operationIdMasked: mask(operationId),
        asaasIdMasked: mask(expectedAsaasId),
        metadataFound: Boolean(row),
        paymentFound: Boolean(existing),
        paymentStatus: existing?.status ?? null,
        metadataAmount: metadata ? metadataAmount(metadata) : null,
        sanitizedMetadata: sanitizeCarrinhoMetadataForLog(metadata),
        countsBefore,
        countsAfterDryRun,
        writesDetected: JSON.stringify(countsBefore) !== JSON.stringify(countsAfterDryRun),
        plan,
        webhookEvent: webhook.event,
        webhookStatus: webhook.payment.status,
        asaasWrites: 0,
        checkoutCalls: 0,
        executed: false,
      },
      null,
      2
    )
  );

  if (!plan.ok) process.exit(1);

  if (dryRun) {
    return;
  }

  const confirmId = arg("--confirm-asaas-id")?.trim();
  if (confirmId !== expectedAsaasId) {
    console.error(
      JSON.stringify({
        ok: false,
        abort: "CONFIRM_ASAAS_ID",
        message: "--execute exige --confirm-asaas-id igual a --asaas-id.",
      })
    );
    process.exit(1);
  }

  const result = await processPaymentWebhook(webhook);
  console.log(
    JSON.stringify({
      executed: true,
      received: (result as { received?: boolean }).received === true,
      success: (result as { success?: boolean }).success === true,
      asaasWrites: 0,
    })
  );
}

main()
  .catch((err) => {
    console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "erro" }));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
