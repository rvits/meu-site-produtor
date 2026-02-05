import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { code, total } = body;

    if (!code || typeof code !== "string") {
      return NextResponse.json(
        { error: "Código do cupom é obrigatório" },
        { status: 400 }
      );
    }

    if (typeof total !== "number" || total < 0) {
      return NextResponse.json(
        { error: "Valor total inválido" },
        { status: 400 }
      );
    }

    // Buscar cupom
    const coupon = await prisma.coupon.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!coupon) {
      return NextResponse.json(
        { error: "Cupom inexistente. Verifique o código e tente novamente." },
        { status: 404 }
      );
    }

    // Verificar se já foi usado
    if (coupon.used) {
      return NextResponse.json(
        { error: "Este cupom já foi utilizado e não pode ser usado novamente." },
        { status: 400 }
      );
    }

    // Verificar se está associado a um agendamento pendente (não pode ser usado em outro agendamento)
    if (coupon.appointmentId) {
      const agendamentoAssociado = await prisma.appointment.findUnique({
        where: { id: coupon.appointmentId },
      });
      
      if (agendamentoAssociado && agendamentoAssociado.status === "pendente") {
        return NextResponse.json(
          { error: "Este cupom já está sendo usado em um agendamento pendente. Aguarde a confirmação ou cancele o agendamento anterior." },
          { status: 400 }
        );
      }
    }

    // Verificar se expirou
    const agora = new Date();
    if (coupon.expiresAt && new Date(coupon.expiresAt) < agora) {
      return NextResponse.json(
        { error: "Este cupom expirou" },
        { status: 400 }
      );
    }

    // Verificar regra especial: cupons de plano expiram 1 mês após expiração do plano
    if (coupon.userPlanId && coupon.discountType === "service") {
      const userPlan = await prisma.userPlan.findUnique({
        where: { id: coupon.userPlanId },
      });

      if (userPlan && userPlan.endDate) {
        const umMesAposPlano = new Date(userPlan.endDate);
        umMesAposPlano.setMonth(umMesAposPlano.getMonth() + 1);
        
        // Se passou 1 mês após expiração do plano, cupom é inválido
        if (agora > umMesAposPlano) {
          return NextResponse.json(
            { error: "Este cupom expirou. Cupons de plano são válidos até 1 mês após a expiração do plano." },
            { status: 400 }
          );
        }
      }
    }

    // Verificar valor mínimo
    if (coupon.minValue && total < coupon.minValue) {
      return NextResponse.json(
        { error: `Valor mínimo para usar este cupom é R$ ${coupon.minValue.toFixed(2).replace(".", ",")}` },
        { status: 400 }
      );
    }

    // Calcular desconto baseado no tipo de cupom
    let discount = 0;
    let finalTotal = total;
    let isServiceCoupon = false;
    const isRefundCoupon = coupon.couponType === "reembolso";
    const isPlanCoupon = coupon.couponType === "plano";

    if (coupon.discountType === "service") {
      // Cupom de serviço (só de planos) - zera o valor do serviço específico
      isServiceCoupon = true;
      discount = total;
      finalTotal = 0;
    } else if (coupon.discountType === "percent") {
      discount = (total * coupon.discountValue) / 100;
      if (coupon.maxDiscount && discount > coupon.maxDiscount) {
        discount = coupon.maxDiscount;
      }
      finalTotal = total - discount;
    } else {
      // Fixed discount
      if (isRefundCoupon) {
        // Cupom de reembolso: pode ser usado como desconto parcial
        // Se o valor do cupom for maior que o total, apenas zera (não acumula sobras)
        if (coupon.discountValue >= total) {
          discount = total;
          finalTotal = 0;
        } else {
          // Desconto parcial: usuário paga a diferença
          discount = coupon.discountValue;
          finalTotal = total - discount;
        }
      } else {
        // Cupom de plano (fixed): comportamento normal
        discount = coupon.discountValue;
        finalTotal = total - discount;
      }
    }

    // Garantir que desconto não seja maior que o total (exceto para cupons de serviço)
    if (!isServiceCoupon && discount > total) {
      discount = total;
      finalTotal = 0;
    }

    // IMPORTANTE: Cupons de reembolso não acumulam sobras
    // Se o cupom for maior que o total, o desconto é apenas o total (sobras se perdem)

    return NextResponse.json({
      valid: true,
      discount,
      finalTotal,
      isServiceCoupon,
      couponType: coupon.couponType,
      coupon: {
        code: coupon.code,
        couponType: coupon.couponType,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        serviceType: coupon.serviceType,
      },
    });
  } catch (error: any) {
    console.error("[API] Erro ao validar cupom:", error);
    return NextResponse.json(
      { error: "Erro ao validar cupom" },
      { status: 500 }
    );
  }
}
