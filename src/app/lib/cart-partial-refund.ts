/**
 * Valor de reembolso parcial para pagamento de carrinho.
 * Carrega metadata e irmãos já reembolsados; a decisão fica em cart-partial-refund-decision.
 * Nunca permite estornar mais que o restante do pagamento.
 */
import { prisma } from "@/app/lib/prisma";
import {
  blockedPartialRefund,
  decideCartPartialRefund,
  parseAppointmentIds,
  parseCartRefundItems,
  roundMoney,
  type CartRefundItem,
  type PartialRefundDecision,
} from "@/app/lib/cart-partial-refund-decision";

export async function resolveCartPartialRefundAmount(params: {
  payment: {
    id: string;
    amount: number;
    asaasId: string | null;
    appointmentId: number | null;
    appointmentIds: unknown;
  };
  appointmentId: number;
  link?: "direct" | "coupon_root";
}): Promise<PartialRefundDecision> {
  const { payment, appointmentId } = params;
  const link = params.link ?? "direct";
  const ids = parseAppointmentIds(payment);

  let items: CartRefundItem[] | null = null;
  if (payment.asaasId) {
    const meta = await prisma.paymentMetadata.findFirst({
      where: { asaasId: payment.asaasId },
      select: { metadata: true },
    });
    items = parseCartRefundItems(meta?.metadata);
  }

  const probe = decideCartPartialRefund({
    paymentAmount: payment.amount,
    appointmentIds: ids,
    appointmentId,
    items,
    alreadyRefunded: 0,
    link,
  });
  if (probe.blocked || ids.length <= 1) return probe;

  const siblings = await prisma.appointment.findMany({
    where: {
      id: { in: ids.filter((id) => id !== appointmentId) },
      cancelRefundOption: "reembolso",
      refundProcessedAt: { not: null },
    },
    select: { id: true },
  });

  let alreadyRefunded = 0;
  if (items && items.length === ids.length && !items.some((item) => item.aggregate)) {
    for (const sibling of siblings) {
      const index = ids.indexOf(sibling.id);
      const item = index >= 0 ? items[index] : undefined;
      if (!item || item.total <= 0) {
        return blockedPartialRefund("no_item_split", payment.amount, 0);
      }
      alreadyRefunded += item.total;
    }
  }

  return decideCartPartialRefund({
    paymentAmount: payment.amount,
    appointmentIds: ids,
    appointmentId,
    items,
    alreadyRefunded: roundMoney(alreadyRefunded),
    link,
  });
}
