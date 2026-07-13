import { Prisma } from "@prisma/client";
import { prisma } from "@/app/lib/prisma";
import { generateCouponCode } from "@/app/lib/coupons";
import {
  expandAgendamentoItemToCouponTypes,
  normalizeServiceTypeId,
} from "@/app/lib/service-catalog";
import type { Coupon } from "@prisma/client";
import {
  isSymbolicAgendamentoCouponStyle,
  SYMBOLIC_AGENDAMENTO_BRL,
} from "@/app/lib/symbolic-payment";
import { toPersistedCouponType } from "@/app/lib/domain/coupon-types";

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
    serviceTypesToCreate.push("sessao");
  }

  return serviceTypesToCreate.map((type) => normalizeServiceTypeId(type));
}

async function allocateUniqueCouponCode(
  tx: Prisma.TransactionClient,
  isTestStyle: boolean
): Promise<string> {
  if (isTestStyle) {
    for (let attempt = 0; attempt < 25; attempt++) {
      const code = `TESTE_${generateCouponCode()}`;
      const existing = await tx.coupon.findUnique({ where: { code } });
      if (!existing) return code;
    }
  }
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = generateCouponCode();
    const existing = await tx.coupon.findUnique({ where: { code } });
    if (!existing) return code;
  }
  return `CUP_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
}

/**
 * Cria um cupom por tipo atômico liberado pelo pagamento (pacotes compostos viram mix/master, beats múltiplos, etc.).
 * Usado no webhook Asaas, reprocessar pagamento teste e qualquer fluxo que replique a mesma regra.
 *
 * Idempotente por `paymentId`: se o webhook Asaas reenviar o mesmo pagamento, não duplica cupons.
 *
 * Os cupons gerados **não** recebem `appointmentId`: ficam ligados ao pagamento (`paymentId`).
 * Apenas o cupom aplicado no checkout (`cupomCode`) recebe `appointmentId` + `used` no webhook.
 */
export async function createCouponsForAgendamentoItems(params: {
  userId: string;
  paymentId: string;
  /** Reservado para compatibilidade; não é mais gravado nos cupons gerados por linha de pagamento */
  appointmentId?: number | null;
  services: ItemLine[];
  beats: ItemLine[];
  /** Pagamento simbólico (admin): validade mais curta e prefixo TESTE_ */
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
          const code = await allocateUniqueCouponCode(tx, isTestPayment);
          const expiresAt = new Date(expiresAtBase);
          const c = await tx.coupon.create({
            data: {
              code,
              couponType: isTestPayment
                ? toPersistedCouponType("TEST")
                : toPersistedCouponType("SERVICE"),
              discountType: "service",
              discountValue: 0,
              serviceType,
              paymentId,
              assignedUserId: userId,
              expiresAt,
            },
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
