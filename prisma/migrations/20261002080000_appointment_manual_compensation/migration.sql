-- Compensação administrativa de agendamento recusado/cancelado.
-- Aditiva: não altera colunas existentes e não preenche registros.

ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "manualCompensationAt" TIMESTAMP(3);
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "manualCompensationBy" TEXT;
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "manualCompensationReason" TEXT;
