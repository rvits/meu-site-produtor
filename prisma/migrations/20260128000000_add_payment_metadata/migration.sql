-- CreateTable
CREATE TABLE "PaymentMetadata" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "asaasId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PaymentMetadata_userId_idx" ON "PaymentMetadata"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentMetadata_asaasId_key" ON "PaymentMetadata"("asaasId");

-- CreateIndex
CREATE INDEX "PaymentMetadata_expiresAt_idx" ON "PaymentMetadata"("expiresAt");
