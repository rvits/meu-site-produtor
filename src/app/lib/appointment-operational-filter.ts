/**
 * Filtro operacional mínimo para queries de agendamento (PR-03).
 * Subconjunto autocontido — sem dependência de appointment-admin-archive / appointment-hidden.
 */

/** Exclui arquivados do pool operacional (disponibilidade, conflito de horário). */
export const appointmentOperationalFilter = {
  adminArchivedAt: null,
} as const;
