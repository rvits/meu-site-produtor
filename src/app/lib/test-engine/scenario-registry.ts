/**
 * TE-01B — Scenario Registry (TE-S01…TE-S13 extensível).
 */
import { teS01CompraSimples } from "@/app/lib/test-engine/scenarios/te-s01-compra-simples";
import { stubScenarios } from "@/app/lib/test-engine/scenarios/stubs";
import type { ScenarioDefinition, ScenarioId } from "@/app/lib/test-engine/types";

const registry = new Map<ScenarioId, ScenarioDefinition>();

function register(def: ScenarioDefinition): void {
  registry.set(def.id, def);
}

register(teS01CompraSimples);
for (const stub of stubScenarios) {
  register(stub);
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
