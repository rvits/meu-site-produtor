/**
 * Confirmação visual de agendamento atômico.
 * Single-order usa exigeAgendamentoNoCheckout / exigeAgendamentoHora /
 * exigeAgendamentoSomenteData. Multi-order não abre confirmação.
 * Não reserva slot, não precifica e não altera o marcador técnico 22:00.
 */
import {
  exigeAgendamentoHora,
  exigeAgendamentoNoCheckout,
  exigeAgendamentoSomenteData,
} from "@/app/lib/agendamento-payment-rules";

export type ConfirmationLine = {
  id?: string;
  nome?: string;
  quantidade?: number;
};

export type AppointmentConfirmationView = {
  serviceName: string;
  dateLabel: string;
  /** null = date-only: a UI não renderiza horário. */
  hourLabel: string | null;
  valueLabel: string;
  question: string;
};

export type CartScheduleItem = {
  data?: string | null;
  hora?: string | null;
  servicos?: ConfirmationLine[];
  beats?: ConfirmationLine[];
};

export function purchaseNeedsAppointmentConfirmation(
  services: ConfirmationLine[] = [],
  beats: ConfirmationLine[] = []
): boolean {
  return exigeAgendamentoNoCheckout(services, beats);
}

export function formatConfirmationDate(dateIso?: string | null): string {
  if (!dateIso) return "—";
  const [year, month, day] = dateIso.split("-");
  if (year && month && day) return `${day}/${month}/${year}`;
  return dateIso;
}

export function formatConfirmationMoney(value: number): string {
  const safe = Number.isFinite(value) ? value : 0;
  return `R$ ${safe.toFixed(2).replace(".", ",")}`;
}

function activeLineName(services: ConfirmationLine[], beats: ConfirmationLine[]): string {
  const line = [...services, ...beats].find((item) => Math.max(0, Number(item.quantidade) || 0) > 0);
  return (line?.nome || line?.id || "Serviço").trim();
}

export function buildPurchaseConfirmation(input: {
  services?: ConfirmationLine[];
  beats?: ConfirmationLine[];
  dateIso?: string | null;
  civilHour?: string | null;
  value: number;
}): AppointmentConfirmationView | null {
  const services = input.services ?? [];
  const beats = input.beats ?? [];
  if (!purchaseNeedsAppointmentConfirmation(services, beats)) return null;

  const serviceName = activeLineName(services, beats);
  const dateLabel = formatConfirmationDate(input.dateIso);
  const valueLabel = formatConfirmationMoney(input.value);
  const showHour = exigeAgendamentoHora(services, beats);
  const hourLabel = showHour ? (input.civilHour || "").trim() || "—" : null;
  const question = hourLabel
    ? `Você tem certeza que quer agendar o serviço ${serviceName} no dia ${dateLabel} às ${hourLabel}, no valor de ${valueLabel}?`
    : `Você tem certeza que quer agendar o serviço ${serviceName} no dia ${dateLabel}, no valor de ${valueLabel}?`;

  return { serviceName, dateLabel, hourLabel, valueLabel, question };
}

/** Resgate de um direito já pago. O valor devido nesta operação é sempre zero. */
export function buildCouponRedemptionConfirmation(input: {
  serviceType?: string | null;
  serviceName: string;
  dateIso?: string | null;
  civilHour?: string | null;
}): AppointmentConfirmationView {
  const line = [{ id: input.serviceType || undefined, nome: input.serviceName, quantidade: 1 }];
  const showHour = exigeAgendamentoHora(line, []);
  const dateLabel = formatConfirmationDate(input.dateIso);
  const valueLabel = formatConfirmationMoney(0);
  const hourLabel = showHour ? (input.civilHour || "").trim() || "—" : null;
  const question = hourLabel
    ? `Você tem certeza que quer agendar o serviço ${input.serviceName} no dia ${dateLabel} às ${hourLabel}, no valor de ${valueLabel}?`
    : `Você tem certeza que quer agendar o serviço ${input.serviceName} no dia ${dateLabel}, no valor de ${valueLabel}?`;
  return {
    serviceName: input.serviceName,
    dateLabel,
    hourLabel,
    valueLabel,
    question,
  };
}

/**
 * Cabeçalho do carrinho.
 * Date-only esconde o horário mesmo quando a hora técnica é 22:00.
 * Horário civil real (inclusive 22:00 de Sessão/Captação) continua visível.
 * Pacote/multi-order mantém a linha atual.
 */
export function formatCartScheduleHeading(item: CartScheduleItem): string {
  const services = item.servicos ?? [];
  const beats = item.beats ?? [];
  const dataStr = formatConfirmationDate(item.data);
  if (exigeAgendamentoSomenteData(services, beats)) return dataStr;
  return `${dataStr} às ${item.hora || "—"}`;
}

export function confirmChoiceExecutesContinuation(choice: "voltar" | "confirmar"): boolean {
  return choice === "confirmar";
}

/** Primeiro clique confirma; o seguinte, enquanto o guard estiver armado, não repete. */
export function claimSingleConfirmation(guard: { current: boolean }): boolean {
  if (guard.current) return false;
  guard.current = true;
  return true;
}

/**
 * Linhas de data/horário do resumo da página.
 * Tipo A: data e horário. Tipo B: só data. Tipo C e seleção vazia: nenhuma.
 */
export function buildScheduleSummaryLines(input: {
  services?: ConfirmationLine[];
  beats?: ConfirmationLine[];
  dateLabel?: string | null;
  hourLabel?: string | null;
}): string[] {
  const services = input.services ?? [];
  const beats = input.beats ?? [];
  const lines: string[] = [];
  if (exigeAgendamentoNoCheckout(services, beats)) {
    lines.push(`Data: ${input.dateLabel || "—"}`);
  }
  if (exigeAgendamentoHora(services, beats)) {
    lines.push(`Horário: ${input.hourLabel || "—"}`);
  }
  return lines;
}
