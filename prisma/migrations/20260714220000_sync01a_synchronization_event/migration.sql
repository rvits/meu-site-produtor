-- SYNC-01A — Outbox persistido do Synchronization Engine
CREATE TABLE "SynchronizationEvent" (
    "id" TEXT NOT NULL,
    "cursor" BIGSERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "scope" TEXT NOT NULL DEFAULT 'user',
    "userId" TEXT,
    "surfaces" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'state-machine',
    "payload" TEXT NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SynchronizationEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SynchronizationEvent_cursor_key" ON "SynchronizationEvent"("cursor");
CREATE INDEX "SynchronizationEvent_cursor_idx" ON "SynchronizationEvent"("cursor");
CREATE INDEX "SynchronizationEvent_occurredAt_idx" ON "SynchronizationEvent"("occurredAt");
CREATE INDEX "SynchronizationEvent_userId_cursor_idx" ON "SynchronizationEvent"("userId", "cursor");
CREATE INDEX "SynchronizationEvent_scope_cursor_idx" ON "SynchronizationEvent"("scope", "cursor");
CREATE INDEX "SynchronizationEvent_name_idx" ON "SynchronizationEvent"("name");
CREATE INDEX "SynchronizationEvent_entity_entityId_idx" ON "SynchronizationEvent"("entity", "entityId");
