import { prisma } from "@/app/lib/prisma";
import { filterBookingCouponsEligibleForRelease, sortCouponsDeterministic } from "@/app/lib/coupon-selection";

/**
 * Libera todos os cupons de “uso” no agendamento (exclui tipo reembolso de remarcação).
 * Ordem determinística; se houver mais de um vínculo incorreto, todos são limpos.
 */
export async function releaseBookingCouponsForAppointment(appointmentId: number): Promise<number> {
  const list = await prisma.coupon.findMany({
    where: { appointmentId },
  });
  const eligible = filterBookingCouponsEligibleForRelease(list);
  const sorted = sortCouponsDeterministic(eligible);
  let n = 0;
  for (const c of sorted) {
    await prisma.coupon.update({
      where: { id: c.id },
      data: {
        appointmentId: null,
        used: false,
        usedAt: null,
        usedBy: null,
      },
    });
    n++;
    console.log(`[CupomRelease] Cupom ${c.code} liberado (agendamento ${appointmentId})`);
  }
  return n;
}
