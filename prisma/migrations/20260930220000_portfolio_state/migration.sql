CREATE TABLE "PortfolioState" (
    "id" TEXT NOT NULL,
    "draftDocument" JSONB NOT NULL,
    "publishedDocument" JSONB NOT NULL,
    "draftVersion" INTEGER NOT NULL DEFAULT 0,
    "publishedVersion" INTEGER NOT NULL DEFAULT 0,
    "draftUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PortfolioState_pkey" PRIMARY KEY ("id")
);
