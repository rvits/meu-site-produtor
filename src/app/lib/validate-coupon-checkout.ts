import { prisma } from "@/app/lib/prisma";

type ServicoItem = { preco?: number; quantidade?: number };
type BeatItem = { preco?: number; quantidade?: number };

/**
 * Valida cupom e retorna o total final a ser cobrado.
 * Usado pelos checkouts para garantir que o valor está correto.
 */
export async function validateCouponAndGetTotal(
  code: string,
  totalRaw: number,
  servicos: ServicoItem[] = [],
  beats: BeatItem[] = []
): Promise<
  | { ok: true; finalTotal: number }
  | { ok: false; error: string }
> {
  const totalServicos = Array.isArray(servicos)
    ? servicos.reduce((acc, s) => acc + ((s.preco || 0) * (s.quantidade || 0)), 0)
    : 0;
  const totalBeats = Array.isArray(beats)
    ? beats.reduce((acc, b) => acc + ((b.preco || 0) * (b.quantidade || 0)), 0)
    : 0;
  const total = totalServicos + totalBeats;

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.toUpperCase() },
  });

  if (!coupon) {
    return { ok: false, error: "Cupom inexistente. Verifique o código e tente novamente." };
  }

  if (coupon.used) {
    return { ok: false, error: "Este cupom já foi utilizado e não pode ser usado novamente." };
  }

  if (coupon.appointmentId) {
    const agendamentoAssociado = await prisma.appointment.findUnique({
      where: { id: coupon.appointmentId },
    });
    if (agendamentoAssociado && agendamentoAssociado.status === "pendente") {
      return {
        ok: false,
        error:
          "Este cupom já está sendo usado em um agendamento pendente. Aguarde a confirmação ou cancele o agendamento anterior.",
      };
    }
  }

  const agora = new Date();
  if (coupon.expiresAt && new Date(coupon.expiresAt) < agora) {
    return { ok: false, error: "Este cupom expirou" };
  }

  if (
    coupon.userPlanId &&
    (coupon.discountType === "service" || coupon.discountType === "percent")
  ) {
    const userPlan = await prisma.userPlan.findUnique({
      where: { id: coupon.userPlanId },
    });
    if (userPlan && userPlan.endDate) {
      const umMesAposPlano = new Date(userPlan.endDate);
      umMesAposPlano.setMonth(umMesAposPlano.getMonth() + 1);
      if (agora > umMesAposPlano) {
        return {
          ok: false,
          error:
            "Este cupom expirou. Cupons de plano são válidos até 1 mês após a expiração do plano.",
        };
      }
    }
  }

  if (coupon.minValue && total < coupon.minValue) {
    return {
      ok: false,
      error: `Valor mínimo para usar este cupom é R$ ${coupon.minValue.toFixed(2).replace(".", ",")}`,
    };
  }

  if (coupon.serviceType === "percent_servicos" && totalBeats > 0) {
    return {
      ok: false,
      error:
        "Este cupom de 10% é válido apenas para serviços avulsos (captação, mix, master, etc.). Não pode ser usado em beats. Para beats, use o cupom de desconto específico para beats.",
    };
  }

  if (coupon.serviceType === "percent_beats" && totalServicos > 0) {
    return {
      ok: false,
      error:
        "Este cupom de 10% é válido apenas para beats. Não pode ser usado em serviços avulsos (captação, mix, master, etc.). Para serviços, use o cupom de desconto específico para serviços.",
    };
  }

  let discount = 0;
  let finalTotal = total;
  let isServiceCoupon = false;
  const isRefundCoupon = coupon.couponType === "reembolso";

  if (coupon.discountType === "service") {
    isServiceCoupon = true;
    discount = total;
    finalTotal = 0;
  } else if (coupon.discountType === "percent") {
    const baseParaDesconto =
      coupon.serviceType === "percent_servicos"
        ? totalServicos
        : coupon.serviceType === "percent_beats"
          ? totalBeats
          : total;
    discount = (baseParaDesconto * coupon.discountValue) / 100;
    if (coupon.maxDiscount && discount > coupon.maxDiscount) {
      discount = coupon.maxDiscount;
    }
    finalTotal = total - discount;
  } else {
    if (isRefundCoupon) {
      if (coupon.discountValue >= total) {
        discount = total;
        finalTotal = 0;
      } else {
        discount = coupon.discountValue;
        finalTotal = total - discount;
      }
    } else {
      discount = coupon.discountValue;
      finalTotal = total - discount;
    }
  }

  if (!isServiceCoupon && discount > total) {
    discount = total;
    finalTotal = 0;
  }

  return { ok: true, finalTotal: Math.round(finalTotal * 100) / 100 };
}
