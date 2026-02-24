/**
 * Fonte única de preços dos planos - usado em toda a aplicação
 */
export const PLAN_PRICES = [
  {
    id: "bronze",
    nome: "Plano Bronze",
    mensal: 249.99,
    anual: 2499.9,
  },
  {
    id: "prata",
    nome: "Plano Prata",
    mensal: 449.99,
    anual: 4499.9,
  },
  {
    id: "ouro",
    nome: "Plano Ouro",
    mensal: 799.99,
    anual: 7999.9,
  },
] as const;

export function getPlanPrice(planId: string, modo: "mensal" | "anual"): number {
  const plano = PLAN_PRICES.find((p) => p.id === planId);
  if (!plano) return 0;
  return modo === "mensal" ? plano.mensal : plano.anual;
}
