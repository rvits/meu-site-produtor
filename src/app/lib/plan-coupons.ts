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
  // IMPORTANTE: 
  // - Para captação, cada cupom = 1h, então 2h = 2 cupons separados
  // - Mixagem e masterização são separados (não mix_master combinado)
  // - Beats são separados por beat individual (beat1, beat2, etc)
  // - Sonoplastia é um serviço separado
  const planServices: Record<string, Array<{ type: string; quantity: number }>> = {
    teste: [
      { type: "captacao", quantity: 1 }, // 1h de captação para teste
      { type: "mix", quantity: 1 }, // 1 cupom de mixagem
    ],
    bronze: [
      { type: "captacao", quantity: 2 }, // 2 cupons de captação (1h cada = 2h total)
      { type: "mix", quantity: 1 }, // 1 cupom de mixagem
      { type: "master", quantity: 1 }, // 1 cupom de masterização
    ],
    prata: [
      { type: "captacao", quantity: 2 }, // 2 cupons de captação (1h cada = 2h total)
      { type: "mix", quantity: 2 }, // 2 cupons de mixagem (separados)
      { type: "master", quantity: 2 }, // 2 cupons de masterização (separados)
      { type: "beat1", quantity: 1 }, // 1 cupom de beat
      { type: "sonoplastia", quantity: 1 }, // 1 cupom de sonoplastia
    ],
    ouro: [
      { type: "captacao", quantity: 4 }, // 4 cupons de captação (1h cada = 4h total)
      { type: "mix", quantity: 2 }, // 2 cupons de mixagem (separados)
      { type: "master", quantity: 2 }, // 2 cupons de masterização (separados)
      { type: "producao_completa", quantity: 2 }, // 2 produções completas
      { type: "beat1", quantity: 1 }, // 1 cupom de beat
      { type: "beat2", quantity: 1 }, // 1 cupom de beat adicional
      { type: "sonoplastia", quantity: 2 }, // 2 cupons de sonoplastia
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

        const coupon = await prisma.coupon.create({
          data: {
            code,
            couponType: "plano", // Cupom de plano
            discountType: "service",
            discountValue: 0, // Não tem valor monetário, é um serviço
            serviceType: service.type,
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
