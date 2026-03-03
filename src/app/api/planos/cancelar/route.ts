import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import { requireAuth } from "@/app/lib/auth";
import { sendPlanCancellationEmail } from "@/app/lib/sendEmail";
import { cancelAsaasSubscription } from "@/app/lib/asaas-subscriptions";

/**
 * Cancela o plano do usuário.
 * - Apenas confirmação: não há opção de reembolso nem cupom.
 * - Cupons vinculados ao plano permanecem no banco mas ficam inativos (não são mais exibidos nem utilizáveis na conta do usuário).
 * - No admin o plano aparece como cancelado e os cupons como inativos; o admin pode excluir do banco depois.
 */
export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { userPlanId } = body;

    if (!userPlanId) {
      return NextResponse.json({ error: "ID do plano é obrigatório" }, { status: 400 });
    }

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

    if (userPlan.userId !== user.id) {
      return NextResponse.json({ error: "Acesso negado" }, { status: 403 });
    }

    if (userPlan.status !== "active") {
      return NextResponse.json({ error: "Plano já está inativo ou cancelado" }, { status: 400 });
    }

    const planCoupons = await prisma.coupon.findMany({
      where: { userPlanId: userPlanId },
    });
    const totalServices = planCoupons.length;
    const usedServices = planCoupons.filter((c) => c.used).length;

    // Cancelar assinatura no Asaas se existir
    if (userPlan.subscription?.asaasSubscriptionId) {
      try {
        await cancelAsaasSubscription(userPlan.subscription.asaasSubscriptionId);
        console.log(`[Cancelar Plano] Assinatura cancelada no Asaas: ${userPlan.subscription.asaasSubscriptionId}`);
      } catch (asaasError: any) {
        console.error("[Cancelar Plano] Erro ao cancelar assinatura no Asaas (não crítico):", asaasError);
      }
    }

    // Atualizar status do plano para "cancelled" (cupons ficam inativos por vínculo com o plano)
    await prisma.userPlan.update({
      where: { id: userPlanId },
      data: { status: "cancelled" },
    });

    if (userPlan.subscription) {
      await prisma.subscription.update({
        where: { id: userPlan.subscription.id },
        data: { status: "cancelled" },
      });
    }

    try {
      await sendPlanCancellationEmail(
        userPlan.user.email,
        userPlan.user.nomeArtistico,
        userPlan.planName,
        null,
        null,
        usedServices,
        totalServices
      );
      console.log(`[Cancelar Plano] Email de cancelamento enviado para ${userPlan.user.email}`);
    } catch (emailError: any) {
      console.error("[Cancelar Plano] Erro ao enviar email (não crítico):", emailError);
    }

    return NextResponse.json({
      message: "Plano cancelado com sucesso",
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
