/**
 * HS-02B — Autoridade operacional do domínio Service.
 *
 * Contratos:
 * - Appointment = solicitação do cliente (agenda/admin/pagamento)
 * - Service = trabalho executado pela equipe (autoridade operacional)
 * - Payment = domínio financeiro
 *
 * Após o aceite, status de execução vive em Service.
 * Appointment.sync apenas espelha agregação admin (não é fonte operacional).
 */

export const SERVICE_STATUSES = [
  "pendente",
  "aceito",
  "em_andamento",
  "recusado",
  "cancelado",
  "concluido",
] as const;

export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

/** Serviços que ainda estão na fila operacional (Serviços Selecionados). */
export const ACTIVE_OPERATIONAL_SERVICE_STATUSES: ReadonlySet<string> = new Set([
  "pendente",
  "aceito",
  "em_andamento",
]);

export const TERMINAL_SERVICE_STATUSES: ReadonlySet<string> = new Set([
  "concluido",
  "cancelado",
  "recusado",
]);

/** Mapeia status administrativo do Appointment → status inicial de Service (somente na criação). */
export function mapRequestStatusToServiceStatus(appointmentStatus: string): ServiceStatus {
  if (appointmentStatus === "em_andamento") return "em_andamento";
  if (appointmentStatus === "concluido") return "concluido";
  if (appointmentStatus === "aceito" || appointmentStatus === "confirmado") return "aceito";
  if (appointmentStatus === "cancelado") return "cancelado";
  if (appointmentStatus === "recusado") return "recusado";
  return "pendente";
}

export function isOpenServiceStatus(status: string): boolean {
  return !TERMINAL_SERVICE_STATUSES.has(status);
}

export function parsePaymentMetadataJson(
  raw: unknown
): Record<string, unknown> {
  if (raw == null) return {};
  if (typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw || "{}");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Derivação única Appointment ← Services (espelho administrativo).
 * Não deve ser usada como fonte de verdade operacional nas UIs de execução.
 */
export function deriveAppointmentStatusFromServiceStatuses(
  appointmentStatus: string,
  serviceStatuses: string[]
): string | null {
  if (serviceStatuses.length === 0) return null;
  if (appointmentStatus === "cancelado" || appointmentStatus === "recusado") {
    return null;
  }

  const open = serviceStatuses.filter((s) => isOpenServiceStatus(s));
  const anyEmAndamento = serviceStatuses.some((s) => s === "em_andamento");
  const anyAceito = serviceStatuses.some((s) => s === "aceito");
  const anyConcluido = serviceStatuses.some((s) => s === "concluido");
  const allTerminal = serviceStatuses.every((s) => TERMINAL_SERVICE_STATUSES.has(s));
  const allCancelledLike = serviceStatuses.every(
    (s) => s === "cancelado" || s === "recusado"
  );

  let aptStatus = appointmentStatus;

  if (aptStatus === "pendente" && anyEmAndamento) return "em_andamento";
  if (aptStatus === "pendente" && anyAceito) return "aceito";

  if (aptStatus === "concluido" && open.length > 0) {
    return anyEmAndamento ? "em_andamento" : "aceito";
  }

  if ((aptStatus === "aceito" || aptStatus === "confirmado") && anyEmAndamento) {
    return "em_andamento";
  }

  if (
    allTerminal &&
    anyConcluido &&
    !allCancelledLike &&
    aptStatus !== "concluido" &&
    aptStatus !== "cancelado" &&
    aptStatus !== "recusado"
  ) {
    return "concluido";
  }

  return null;
}
