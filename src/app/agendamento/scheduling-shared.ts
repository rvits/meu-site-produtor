/**
 * Constantes e textos compartilhados entre /agendamento e /agendamento/cupom/[codigo].
 * GO-H3: mesmo vocabulário visual e regras de presencial vs produção.
 */
import { isSchedulableServiceType } from "@/app/lib/service-catalog";

export const SCHEDULE_HORARIOS = [
  "10:00",
  "11:00",
  "12:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
] as const;

/** Texto obrigatório acima do calendário para serviços de produção (sem horários). */
export const PRODUCTION_DELIVERY_DATE_MESSAGE =
  "Selecione a data em que deseja receber o material final. Essa data representa a entrega desejada. Após o envio da solicitação, a equipe analisará a disponibilidade e confirmará ou ajustará essa data conforme a capacidade de produção.";

export function serviceNeedsStudioHours(
  serviceType?: string | null,
  serviceName?: string | null
): boolean {
  return isSchedulableServiceType(serviceType, serviceName);
}

export function minScheduleDateIso(daysAhead = 0): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().slice(0, 10);
}
