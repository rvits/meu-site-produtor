-- Nome de exibição da entrega. Nullable: entregas antigas ficam sem backfill.
ALTER TABLE "Service" ADD COLUMN IF NOT EXISTS "deliveryAudioOriginalName" TEXT;
