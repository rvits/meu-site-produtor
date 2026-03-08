-- AlterTable
-- Colunas de cancelamento e leitura em Appointment (evita erro 500 no webhook e nas páginas que usam agendamentos).
-- PostgreSQL: use npx prisma migrate deploy. Se o lock for sqlite, altere prisma/migrations/migration_lock.toml para provider = "postgresql" ou rode o SQL manualmente no banco.
ALTER TABLE "Appointment" ADD COLUMN "readAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "cancelReason" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "cancelledAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "cancelRefundOption" TEXT;
ALTER TABLE "Appointment" ADD COLUMN "refundProcessedAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN "refundCouponId" TEXT;
