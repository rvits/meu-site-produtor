import { prisma } from "@/app/lib/prisma";
import { ensureUniqueCouponCode, generateCouponCode } from "@/app/lib/coupons";
import { normalizeServiceTypeId } from "@/app/lib/service-catalog";
import type { Coupon } from "@prisma/client";

/** Códigos TESTE_* únicos para rótulos na Minha Conta e lista no admin. */
async function ensureUniqueTestCouponCode(): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt++) {
    const code = `TESTE_${generateCouponCode()}`;
    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (!existing) return code;
  }
  return ensureUniqueCouponCode();
}

type ItemLine = { id?: string; nome?: string; quantidade?: number };

/**
 * Cria um cupom por unidade de serviço/beat pago, com código sempre único e tipo (serviceType) alinhado aos ids do agendamento (sessao, captacao, beat1, producao_completa, etc.).
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
  /** Pagamento de teste (R$ 5): validade mais curta */
  isTestPayment: boolean;
}): Promise<Coupon[]> {
  const { userId, paymentId, services, beats, isTestPayment } = params;

  const jaExistentes = await prisma.coupon.findMany({
    where: { paymentId },
    orderBy: { createdAt: "asc" },
  });
  if (jaExistentes.length > 0) {
    return jaExistentes;
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (isTestPayment ? 30 : 365));

  const coupons: Coupon[] = [];

  const pushOne = async (serviceTypeRaw: string) => {
    const serviceType = normalizeServiceTypeId(serviceTypeRaw);
    const code = isTestPayment ? await ensureUniqueTestCouponCode() : await ensureUniqueCouponCode();
    const c = await prisma.coupon.create({
      data: {
        code,
        couponType: "plano",
        discountType: "service",
        discountValue: 0,
        serviceType,
        paymentId,
        assignedUserId: userId,
        expiresAt,
      },
    });
    coupons.push(c);
  };

  const arrS = Array.isArray(services) ? services : [];
  const arrB = Array.isArray(beats) ? beats : [];

  for (const svc of arrS) {
    const raw = String(svc.id || svc.nome || "sessao");
    const qty = Math.max(1, Number(svc.quantidade) || 1);
    for (let q = 0; q < qty; q++) {
      await pushOne(raw);
    }
  }
  for (const b of arrB) {
    const serviceType = String(b.id || b.nome || "beat1");
    const qty = Math.max(1, Number(b.quantidade) || 1);
    for (let q = 0; q < qty; q++) {
      await pushOne(serviceType);
    }
  }

  const totalLinhas =
    arrS.reduce((acc, s) => acc + Math.max(1, Number(s.quantidade) || 1), 0) +
    arrB.reduce((acc, b) => acc + Math.max(1, Number(b.quantidade) || 1), 0) +
    0;

  if (totalLinhas === 0) {
    await pushOne("sessao");
  }

  return coupons;
}
