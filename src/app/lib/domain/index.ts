/**
 * HS-03A — Domínio operacional consolidado.
 * Appointment · Service · Payment · Coupon
 */

export * from "@/app/lib/domain/statuses";
export * from "@/app/lib/domain/coupon-types";
export * from "@/app/lib/domain/domain-service";
export {
  approveAppointment,
  rejectAppointment,
  startServiceWork,
  cancelAppointment,
  revertAppointmentCancellation,
  startService,
  completeService,
  deliverService,
  updateServiceFields,
  type WorkflowResult,
  type WorkflowOk,
  type WorkflowFail,
} from "@/app/lib/domain/workflow";
