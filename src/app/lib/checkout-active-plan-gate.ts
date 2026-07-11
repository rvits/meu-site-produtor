import { prisma } from "@/app/lib/prisma";

/**
 * Gate mínimo de plano ativo no checkout (PR-03).
 * Subconjunto autocontido — sem dependência de active-user-plan (WIP PR-04+).
 */

export const ACTIVE_PLAN_BLOCK_MESSAGE =
  "Você já possui um plano ativo. Cancele o plano atual em Minha Conta antes de assinar outro.";

export async function findActiveUserPlan(userId: string) {
  return prisma.userPlan.findFirst({
    where: {
      userId,
      status: "active",
      OR: [{ endDate: null }, { endDate: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
}
