/**
 * TE-01B / TE-02A — Scenario Registry.
 */
import { teS01CompraSimples } from "@/app/lib/test-engine/scenarios/te-s01-compra-simples";
import { stubScenarios } from "@/app/lib/test-engine/scenarios/stubs";
import { te02aScenarios } from "@/app/lib/test-engine/scenarios/te02a-batch1";
import { sync01aScenarios } from "@/app/lib/test-engine/scenarios/sync01a-batch";
import type { ScenarioDefinition, ScenarioId } from "@/app/lib/test-engine/types";

const registry = new Map<ScenarioId, ScenarioDefinition>();

function register(def: ScenarioDefinition): void {
  registry.set(def.id, def);
}

register(teS01CompraSimples);
for (const stub of stubScenarios) {
  register(stub);
}
for (const s of te02aScenarios) {
  register(s);
}
for (const s of sync01aScenarios) {
  register(s);
}

export function getScenario(id: ScenarioId): ScenarioDefinition | undefined {
  return registry.get(id);
}

export function listScenarios(): ScenarioDefinition[] {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function listScenarioIds(): ScenarioId[] {
  return listScenarios().map((s) => s.id);
}

export function registerScenario(def: ScenarioDefinition): void {
  register(def);
}
