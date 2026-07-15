/**
 * HS-03B — Histórico de transições (persistente).
 * Preparado para StudioOS; não é Event Sourcing.
 */

import { prisma } from "@/app/lib/prisma";
import type { DomainEvent } from "@/app/lib/domain/state-machine/types";

export async function recordTransitionHistory(event: DomainEvent): Promise<void> {
  try {
    await prisma.domainTransitionHistory.create({
      data: {
        entity: event.entity,
        entityId: event.entityId,
        fromStatus: event.from,
        toStatus: event.to,
        eventName: event.name,
        actorType: event.actor?.type || null,
        actorId: event.actor?.id || null,
        reason: event.reason || null,
        metadata: JSON.stringify(event.metadata || {}),
      },
    });
  } catch (err: any) {
    console.warn(
      "[DomainHistory] Falha ao registrar transição (não crítico):",
      err?.message || err
    );
  }
}

export async function listTransitionHistory(params: {
  entity?: string;
  entityId?: string;
  take?: number;
}) {
  return prisma.domainTransitionHistory.findMany({
    where: {
      ...(params.entity ? { entity: params.entity } : {}),
      ...(params.entityId ? { entityId: params.entityId } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: params.take ?? 100,
  });
}
