/**
 * SIM-01 — Simulation Registry.
 */

import { sim01Scenarios } from "@/app/lib/simulation/scenarios/sim01-batch";
import type { SimulationDefinition, SimulationId } from "@/app/lib/simulation/types";

const registry = new Map<SimulationId, SimulationDefinition>();

for (const s of sim01Scenarios) {
  registry.set(s.id, s);
}

export function getSimulation(id: SimulationId): SimulationDefinition | undefined {
  return registry.get(id);
}

export function listSimulations(): SimulationDefinition[] {
  return [...registry.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function listSimulationIds(): SimulationId[] {
  return listSimulations().map((s) => s.id);
}

export function registerSimulation(def: SimulationDefinition): void {
  registry.set(def.id, def);
}

export function describeSimulationRegistry(): {
  id: SimulationId;
  name: string;
  description: string;
  pipeline: string[];
}[] {
  return listSimulations().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    pipeline: s.pipeline,
  }));
}
