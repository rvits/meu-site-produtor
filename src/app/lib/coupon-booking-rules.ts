/** Agendamentos que impedem reuso de um cupom ainda vinculado por appointmentId */
export const AGENDAMENTO_BLOQUEIA_REUSO_DE_CUPOM = [
  "pendente",
  "aceito",
  "confirmado",
  "em_andamento",
] as const;

export function agendamentoBloqueiaReusoCupom(status: string | null | undefined): boolean {
  if (!status) return false;
  return (AGENDAMENTO_BLOQUEIA_REUSO_DE_CUPOM as readonly string[]).includes(status);
}
