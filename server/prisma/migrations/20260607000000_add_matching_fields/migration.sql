ALTER TABLE "driver_profiles"
  ADD COLUMN "cancellation_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "online_since"      TIMESTAMP(3);
