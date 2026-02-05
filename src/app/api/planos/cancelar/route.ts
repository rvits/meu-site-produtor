import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { sendPlanCancellationEmail } from "@/app/lib/sendEmail";
import { generateCouponCode } from "@/app/lib/coupons";
import { cancelAsaasSubscription } from "@/app/lib/asaas-subscriptions";
import { refundAsaasPayment } from "@/app/lib/asaas-refund";

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { userPlanId, refundType } = body; // refundType: "direct" ou "coupon"

    if (!userPlanId) {
      return NextResponse.json({ error: "ID do plano é obrigatório" }, { status: 400 });
    }

    // Buscar plano do usuário
    const userPlan = await prisma.userPlan.findUnique({
      where: { id: userPlanId },
      include: {
        user: true,
        subscription: true,
      },
    });

    if (!userPlan) {
      return NextResponse.json({ error: "Plano não encontrado" }, { status: 404 });
    }

    // Verificar se o plano pertence ao usuário
    if (userPlan.userId !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    // Verificar se o plano está ativo
    if (userPlan.status !== "active") {
      return NextResponse.json({ error: "Plano já está inativo ou cancelado" }, { status: 400 });
    }

    // Buscar cupons do plano
    const planCoupons = await prisma.coupon.findMany({
      where: {
        userPlanId: userPlanId,
        couponType: "plano",
      },
    });

    // Separar cupons usados e não usados
    const usedCoupons = planCoupons.filter(c => c.used);
    const unusedCoupons = planCoupons.filter(c => !c.used);

    // Calcular valor de reembolso
    // Se não há cupons de serviço, reembolsa 100% do valor do plano
    // Se há cupons, calcula proporcionalmente baseado em serviços não utilizados
    const totalServices = planCoupons.length;
    const usedServices = usedCoupons.length;
    const unusedServices = unusedCoupons.length;

    let refundAmount: number | null = null;
    let couponCode: string | null = null;
    let refundDirectSuccess: boolean = false;
    let actualRefundType: "direct" | "coupon" = refundType || "coupon"; // Variável mutável para controlar o tipo de reembolso

    // Calcular valor do reembolso
    if (totalServices === 0) {
      // Se não há cupons de serviço, reembolsa 100% do valor do plano
      refundAmount = userPlan.amount;
    } else if (unusedServices > 0) {
      // Calcular valor proporcional do reembolso
      // Assumindo que cada serviço tem valor igual (valor do plano / total de serviços)
      const serviceValue = userPlan.amount / Math.max(totalServices, 1);
      refundAmount = serviceValue * unusedServices;
    }

    // Processar reembolso baseado no tipo escolhido
    if (refundAmount && refundAmount > 0) {
      if (actualRefundType === "direct") {
        // Reembolso direto via Asaas
        try {
          // Buscar pagamento do plano
          const payment = await prisma.payment.findFirst({
            where: {
              userId: user.id,
              type: "plano",
              planId: userPlan.planId,
              status: "approved",
            },
            orderBy: { createdAt: "desc" },
          });

          if (payment && payment.asaasId) {
            await refundAsaasPayment(
              payment.asaasId,
              refundAmount,
              `Reembolso de cancelamento do plano ${userPlan.planName}`
            );
            refundDirectSuccess = true;
            console.log(`[Cancelar Plano] Reembolso direto realizado: R$ ${refundAmount.toFixed(2)}`);
          } else {
            console.warn("[Cancelar Plano] Pagamento não encontrado para reembolso direto, criando cupom como fallback");
            // Fallback: criar cupom se não conseguir fazer reembolso direto
            actualRefundType = "coupon";
          }
        } catch (refundError: any) {
          console.error("[Cancelar Plano] Erro ao fazer reembolso direto:", refundError);
          // Fallback: criar cupom se reembolso direto falhar
          actualRefundType = "coupon";
        }
      }

      // Se escolheu cupom ou se reembolso direto falhou, criar cupom
      if (refundType === "coupon" || (!refundDirectSuccess && refundType === "direct")) {
        try {
          const refundCoupon = await prisma.coupon.create({
            data: {
              code: generateCouponCode(),
              couponType: "reembolso",
              discountType: "fixed",
              discountValue: refundAmount,
              expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 dias
            },
          });
          couponCode = refundCoupon.code;
          console.log(`[Cancelar Plano] Cupom de reembolso criado: ${couponCode} - Valor: R$ ${refundAmount.toFixed(2)}`);
        } catch (couponError: any) {
          console.error("[Cancelar Plano] Erro ao criar cupom de reembolso:", couponError);
        }
      }
    }

    // Remover cupons não utilizados
    if (unusedCoupons.length > 0) {
      await prisma.coupon.deleteMany({
        where: {
          id: { in: unusedCoupons.map(c => c.id) },
        },
      });
      console.log(`[Cancelar Plano] ${unusedCoupons.length} cupons não utilizados removidos`);
    }

    // Cancelar assinatura no Asaas se existir
    if (userPlan.subscription && userPlan.subscription.asaasSubscriptionId) {
      try {
        await cancelAsaasSubscription(userPlan.subscription.asaasSubscriptionId);
        console.log(`[Cancelar Plano] Assinatura cancelada no Asaas: ${userPlan.subscription.asaasSubscriptionId}`);
      } catch (asaasError: any) {
        console.error("[Cancelar Plano] Erro ao cancelar assinatura no Asaas (não crítico):", asaasError);
        // Continuar mesmo se não conseguir cancelar no Asaas
      }
    }

    // Atualizar status do plano para "cancelled"
    await prisma.userPlan.update({
      where: { id: userPlanId },
      data: {
        status: "cancelled",
      },
    });

    // Atualizar status da assinatura se existir
    if (userPlan.subscription) {
      await prisma.subscription.update({
        where: { id: userPlan.subscription.id },
        data: {
          status: "cancelled",
        },
      });
    }

    // Enviar email de cancelamento
    try {
      await sendPlanCancellationEmail(
        userPlan.user.email,
        userPlan.user.nomeArtistico,
        userPlan.planName,
        refundAmount,
        couponCode,
        usedServices,
        totalServices
      );
      console.log(`[Cancelar Plano] Email de cancelamento enviado para ${userPlan.user.email}`);
    } catch (emailError: any) {
      console.error("[Cancelar Plano] Erro ao enviar email (não crítico):", emailError);
    }

    return NextResponse.json({
      message: "Plano cancelado com sucesso",
      refundAmount,
      couponCode,
      refundType: refundDirectSuccess ? "direct" : (couponCode ? "coupon" : null),
      usedServices,
      totalServices,
    });
  } catch (err: any) {
    console.error("[Cancelar Plano] Erro:", err);
    if (err.message === "Acesso negado" || err.message === "Não autenticado") {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }
    return NextResponse.json({ error: "Erro ao cancelar plano" }, { status: 500 });
  }
}
