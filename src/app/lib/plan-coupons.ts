import { prisma } from "@/app/lib/prisma";
import { generateCouponCode } from "./coupons";

/**
 * Gera cupons de serviços baseados no plano do usuário
 */
export async function generatePlanServiceCoupons(
  userId: string,
  userPlanId: string,
  planId: string,
  planName: string,
  modo: string
) {
  const coupons: any[] = [];

  // Mapear serviços por plano
  // - Bronze: 1 sessão, 2x 1h captação, 1 mix, 1 cupom 10% serviços
  // - Prata: 1 sessão, 2x 1h captação, 1 mix_master, 1 beat
  // - Ouro: 2 sessão, 4x 1h captação, 2 mix_master, 2 beat, 1 cupom 10% serviços, 1 cupom 10% beats
  // percent_servicos: 10% só em serviços avulsos (NÃO em beats)
  // percent_beats: 10% só em beats (NÃO em outros serviços)
  const planServices: Record<string, Array<{ type: string; quantity: number; discountType?: string; discountValue?: number }>> = {
    teste: [
      { type: "captacao", quantity: 1 },
      { type: "mix", quantity: 1 },
    ],
    bronze: [
      { type: "sessao", quantity: 1 },
      { type: "captacao", quantity: 2 }, // 2 cupons de 1h cada
      { type: "mix", quantity: 1 },
      { type: "percent_servicos", quantity: 1, discountType: "percent", discountValue: 10 },
    ],
    prata: [
      { type: "sessao", quantity: 1 },
      { type: "captacao", quantity: 2 },
      { type: "mix_master", quantity: 1 },
      { type: "beat1", quantity: 1 },
    ],
    ouro: [
      { type: "sessao", quantity: 2 },
      { type: "captacao", quantity: 4 },
      { type: "mix_master", quantity: 2 },
      { type: "beat1", quantity: 2 },
      { type: "percent_servicos", quantity: 1, discountType: "percent", discountValue: 10 },
      { type: "percent_beats", quantity: 1, discountType: "percent", discountValue: 10 },
    ],
  };

  const services = planServices[planId.toLowerCase()] || [];

  // Buscar o plano criado usando userPlanId
  const userPlan = await prisma.userPlan.findUnique({
    where: { id: userPlanId },
  });

  if (!userPlan) {
    console.warn(`[Plan Coupons] Plano não encontrado para gerar cupons: ${userPlanId}`);
    return coupons;
  }

  // Calcular data de expiração dos cupons
  // Regra: Cupons têm validade de 2 meses OU até 1 mês após expiração do plano (o que for maior)
  const agora = new Date();
  const expiresAt = new Date();
  
  // Opção 1: 2 meses a partir de agora
  expiresAt.setMonth(agora.getMonth() + 2);
  
  // Opção 2: 1 mês após expiração do plano
  if (userPlan.endDate) {
    const umMesAposPlano = new Date(userPlan.endDate);
    umMesAposPlano.setMonth(umMesAposPlano.getMonth() + 1);
    
    // Usar a data mais distante (maior)
    if (umMesAposPlano > expiresAt) {
      expiresAt.setTime(umMesAposPlano.getTime());
    }
  }

  // Gerar cupom para cada serviço
  for (const service of services) {
    for (let i = 0; i < service.quantity; i++) {
      try {
        let code = generateCouponCode();
        let attempts = 0;
        
        // Garantir código único
        while (attempts < 10) {
          const exists = await prisma.coupon.findUnique({
            where: { code },
          });
          if (!exists) break;
          code = generateCouponCode();
          attempts++;
        }

        if (attempts >= 10) {
          console.error(`[Plan Coupons] Erro ao gerar código único após ${attempts} tentativas`);
          continue;
        }

        const isPercentCoupon = service.type === "percent_servicos" || service.type === "percent_beats";
        const coupon = await prisma.coupon.create({
          data: {
            code,
            couponType: "plano",
            discountType: isPercentCoupon ? "percent" : "service",
            discountValue: isPercentCoupon ? (service.discountValue ?? 10) : 0,
            serviceType: service.type, // percent_servicos, percent_beats ou tipo de serviço
            userPlanId: userPlan.id,
            expiresAt,
          },
        });

        coupons.push(coupon);
        console.log(`[Plan Coupons] Cupom gerado: ${code} para serviço ${service.type}`);
      } catch (error: any) {
        console.error(`[Plan Coupons] Erro ao gerar cupom para ${service.type}:`, error);
      }
    }
  }

  return coupons;
}
