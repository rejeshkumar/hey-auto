ALTER TABLE "driver_profiles"
  ADD COLUMN "home_lat"        DOUBLE PRECISION,
  ADD COLUMN "home_lng"        DOUBLE PRECISION,
  ADD COLUMN "home_address"    VARCHAR(255),
  ADD COLUMN "is_go_home_mode" BOOLEAN NOT NULL DEFAULT false;
