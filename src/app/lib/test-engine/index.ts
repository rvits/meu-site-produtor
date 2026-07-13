/**
 * TE-01B — núcleo do Test Engine (sem UI).
 */
export {
  assertPayment,
  assertAppointment,
  assertService,
  assertCoupon,
  assertDashboard,
  assertMinhaConta,
} from "@/app/lib/test-engine/assert-engine";

export {
  assertTestEngineAllowed,
  isLocalOrDevelopmentRuntime,
  isPreviewRuntime,
  isProductionRuntimeBlocked,
} from "@/app/lib/test-engine/permissions";

export {
  seedTestUser,
  writeAgendamentoPaymentMetadata,
  dispatchOfficialPaymentReceived,
  dispatchOfficialPaymentReceivedDuplicate,
  ensureServicesOfficial,
} from "@/app/lib/test-engine/pipeline-adapter";

export {
  getScenario,
  listScenarios,
  listScenarioIds,
  registerScenario,
} from "@/app/lib/test-engine/scenario-registry";

export {
  runScenario,
  runAllScenarios,
  describeRegistry,
} from "@/app/lib/test-engine/scenario-runner";

export { buildExecutionReport, printExecutionReport } from "@/app/lib/test-engine/execution-report";

export type {
  ScenarioId,
  ScenarioDefinition,
  ScenarioResult,
  ExecutionReport,
  AssertResult,
  ScenarioContext,
} from "@/app/lib/test-engine/types";
