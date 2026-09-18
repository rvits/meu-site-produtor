/**
 * Mensagens e classificação de agenda (presencial vs produção vs múltiplos direitos).
 * Sem Prisma. Usado no Agendamento, cupom e catálogo.
 */
import {
  exigeAgendamentoHora,
  exigeAgendamentoSomenteData,
  isCouponsOnlyAgendamentoPayment,
} from "@/app/lib/agendamento-payment-rules";
import type { CanonicalServiceId } from "@/app/lib/service-catalog";

export const SCHEDULING_COPY = {
  presencial:
    "Para sessões e captações, escolha a data e o horário em que deseja realizar o atendimento no estúdio.",
  producao:
    "Para serviços de produção, escolha a data em que deseja receber o trabalho concluído. Essa data representa o prazo de entrega desejado, e não o início da produção.",
  producaoCupom:
    "Escolha a data em que deseja receber o trabalho concluído. Essa data representa o prazo de entrega desejado, e não o início da produção.",
  multiplosDireitos:
    "Esta seleção gera direitos independentes. Depois do pagamento, cada serviço é agendado separadamente pelos cupons em Minha Conta.",
} as const;

export type SchedulingHintKind = "presencial" | "producao" | "multiplosDireitos";

type QtyMap = Partial<Record<CanonicalServiceId, number>>;

function linesFromQty(
  qty: QtyMap,
  ids: CanonicalServiceId[]
): Array<{ id: string; quantidade: number }> {
  return ids
    .filter((id) => (qty[id] || 0) > 0)
    .map((id) => ({ id, quantidade: qty[id] || 0 }));
}

const STUDIO_IDS: CanonicalServiceId[] = [
  "sessao",
  "captacao",
  "mix",
  "master",
  "mix_master",
  "sonoplastia",
];

const BEAT_IDS: CanonicalServiceId[] = [
  "beat1",
  "beat2",
  "beat3",
  "beat4",
  "beat_mix_master",
  "producao_completa",
];

export function resolveSelectionSchedulingHint(
  services: Array<{ id: string; quantidade: number }>,
  beats: Array<{ id: string; quantidade: number }>
): SchedulingHintKind | null {
  const has = services.length + beats.length > 0;
  if (!has) return null;
  if (isCouponsOnlyAgendamentoPayment({}, services, beats)) return "multiplosDireitos";
  if (exigeAgendamentoHora(services, beats)) return "presencial";
  if (exigeAgendamentoSomenteData(services, beats)) return "producao";
  return "multiplosDireitos";
}

export function resolveStudioPanelHint(qty: QtyMap): SchedulingHintKind | null {
  return resolveSelectionSchedulingHint(linesFromQty(qty, STUDIO_IDS), []);
}

export function resolveBeatsPanelHint(qty: QtyMap): SchedulingHintKind | null {
  return resolveSelectionSchedulingHint([], linesFromQty(qty, BEAT_IDS));
}

export function schedulingHintText(kind: SchedulingHintKind): string {
  if (kind === "presencial") return SCHEDULING_COPY.presencial;
  if (kind === "producao") return SCHEDULING_COPY.producao;
  return SCHEDULING_COPY.multiplosDireitos;
}

export function couponSchedulingHintText(serviceType?: string | null): string {
  const st = String(serviceType || "").toLowerCase();
  if (st === "sessao" || st === "captacao") return SCHEDULING_COPY.presencial;
  return SCHEDULING_COPY.producaoCupom;
}
