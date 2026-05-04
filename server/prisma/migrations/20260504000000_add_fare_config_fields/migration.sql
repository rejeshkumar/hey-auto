-- Add missing fare config fields (onward surcharge, waiting charge)
-- and onward_surcharge to rides table

-- AlterTable fare_configs
ALTER TABLE "fare_configs"
  ADD COLUMN IF NOT EXISTS "onward_surcharge_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "onward_surcharge_percent" DOUBLE PRECISION NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS "waiting_charge_per_quarter_hour" DOUBLE PRECISION NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "waiting_charge_max_per_day" DOUBLE PRECISION NOT NULL DEFAULT 250;

-- Fix night_multiplier default to Kerala gazette 50% (was 1.25)
ALTER TABLE "fare_configs" ALTER COLUMN "night_multiplier" SET DEFAULT 1.5;

-- AlterTable rides
ALTER TABLE "rides"
  ADD COLUMN IF NOT EXISTS "onward_surcharge" DOUBLE PRECISION NOT NULL DEFAULT 0;
