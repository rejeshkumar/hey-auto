ALTER TABLE "driver_profiles"
  ADD COLUMN "coins_balance"  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coins_earned"   INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "coins_redeemed" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "CoinTxType" AS ENUM ('EARNED', 'REDEEMED');

CREATE TABLE "coin_transactions" (
  "id"          UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "driver_id"   UUID NOT NULL,
  "amount"      INTEGER NOT NULL,
  "type"        "CoinTxType" NOT NULL,
  "description" TEXT,
  "ride_id"     UUID,
  "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "coin_transactions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE
);

CREATE INDEX "coin_transactions_driver_id_idx" ON "coin_transactions"("driver_id", "created_at" DESC);
