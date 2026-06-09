ALTER TABLE "fare_configs"
  ADD COLUMN "cancellation_charge_enabled"    BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "cancellation_charge_amount"     DOUBLE PRECISION NOT NULL DEFAULT 20,
  ADD COLUMN "cancellation_grace_period_min"  DOUBLE PRECISION NOT NULL DEFAULT 3;

ALTER TABLE "rides"
  ADD COLUMN "cancellation_charge" DOUBLE PRECISION NOT NULL DEFAULT 0;
