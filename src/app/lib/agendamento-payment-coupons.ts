import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import {
  expandAgendamentoItemToCouponTypes,
  normalizeServiceTypeId,
} from "@/app/lib/service-catalog";
import type { Coupon } from "@prisma/client";
import {
  isSymbolicAgendamentoCouponStyle,
  SYMBOLIC_AGENDAMENTO_BRL,
} from "@/app/lib/symbolic-payment";
import { createDomainCoupon } from "@/app/lib/domain/coupon-domain";

export { SYMBOLIC_AGENDAMENTO_BRL, isSymbolicAgendamentoCouponStyle };

type ItemLine = { id?: string; nome?: string; quantidade?: number };

export function listCouponServiceTypesForAgendamentoItems(
  services: ItemLine[],
  beats: ItemLine[]
): string[] {
  const arrS = Array.isArray(services) ? services : [];
  const arrB = Array.isArray(beats) ? beats : [];
  const serviceTypesToCreate: string[] = [];

  for (const svc of arrS) {
    serviceTypesToCreate.push(
      ...expandAgendamentoItemToCouponTypes(
        String(svc.id || svc.nome || "sessao"),
        svc.quantidade,
        svc.nome
      )
    );
  }
  for (const b of arrB) {
    serviceTypesToCreate.push(
      ...expandAgendamentoItemToCouponTypes(
        String(b.id || b.nome || "beat1"),
        b.quantidade,
        b.nome
      )
    );
  }
  if (serviceTypesToCreate.length === 0) {
    throw new Error("Nenhum serviço no pagamento para gerar cupons");
  }

  return serviceTypesToCreate.map((type) => normalizeServiceTypeId(type));
}

/**
 * Cria um cupom por tipo atômico liberado pelo pagamento.
 * Pipeline único (real = simbólico). Idempotente por paymentId.
 */
export async function createCouponsForAgendamentoItems(params: {
  userId: string;
  paymentId: string;
  appointmentId?: number | null;
  services: ItemLine[];
  beats: ItemLine[];
  isTestPayment: boolean;
}): Promise<Coupon[]> {
  const { userId, paymentId, services, beats, isTestPayment } = params;
  const serviceTypesToCreate = listCouponServiceTypesForAgendamentoItems(services, beats);

  const expiresAtBase = new Date();
  expiresAtBase.setDate(expiresAtBase.getDate() + (isTestPayment ? 30 : 365));

  try {
    return await prisma.$transaction(
      async (tx) => {
        const jaExistentes = await tx.coupon.findMany({
          where: { paymentId },
          orderBy: { createdAt: "asc" },
        });
        if (jaExistentes.length > 0) {
          return jaExistentes;
        }

        const coupons: Coupon[] = [];
        for (const serviceType of serviceTypesToCreate) {
          const c = await createDomainCoupon(tx, {
            canonicalType: isTestPayment ? "TEST" : "SERVICE",
            discountType: "service",
            discountValue: 0,
            serviceType,
            paymentId,
            assignedUserId: userId,
            expiresAt: new Date(expiresAtBase),
          });
          coupons.push(c);
        }
        return coupons;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 20_000,
      }
    );
  } catch (e) {
    const fallback = await prisma.coupon.findMany({
      where: { paymentId },
      orderBy: { createdAt: "asc" },
    });
    if (fallback.length > 0) return fallback;
    throw e;
  }
}
