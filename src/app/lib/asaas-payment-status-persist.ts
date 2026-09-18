import { prisma } from "@/app/lib/prisma";
import { paymentByProviderIdWhere } from "@/app/lib/payment-provider/identity";
import { nextAsaasPaymentStatus, normalizeAsaasPaymentStatus } from "@/app/lib/asaas-payment-status";

export async function persistAsaasPaymentStatus(params: {
  paymentDbId?: string | null;
  providerPaymentId?: string | null;
  incomingStatus: unknown;
}): Promise<string | null> {
  const nextIncoming = normalizeAsaasPaymentStatus(params.incomingStatus);
  if (!nextIncoming) return null;

  const pay = params.paymentDbId
    ? await prisma.payment.findUnique({
        where: { id: params.paymentDbId },
        select: { id: true, asaasPaymentStatus: true },
      })
    : params.providerPaymentId
      ? await prisma.payment.findFirst({
          where: paymentByProviderIdWhere(params.providerPaymentId),
          select: { id: true, asaasPaymentStatus: true },
        })
      : null;
  if (!pay) return null;

  const next = nextAsaasPaymentStatus(pay.asaasPaymentStatus, nextIncoming);
  if (!next) return pay.asaasPaymentStatus ?? null;
  if (normalizeAsaasPaymentStatus(pay.asaasPaymentStatus) === next) return next;

  await prisma.payment.update({
    where: { id: pay.id },
    data: { asaasPaymentStatus: next },
  });
  return next;
}
