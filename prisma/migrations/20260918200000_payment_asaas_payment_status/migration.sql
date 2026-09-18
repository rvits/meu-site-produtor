-- Último status financeiro informado pelo Asaas (não é Payment.status operacional).
-- Nullable: pagamentos antigos permanecem NULL (sem backfill).
-- Aplicar em produção somente com migrate deploy após revisão — NUNCA prisma db push.

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "asaasPaymentStatus" TEXT;
