CREATE TABLE "auto_stands" (
  "id"           UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "name"         VARCHAR(100) NOT NULL,
  "city"         VARCHAR(50) NOT NULL,
  "lat"          DOUBLE PRECISION NOT NULL,
  "lng"          DOUBLE PRECISION NOT NULL,
  "radius_meters" INTEGER NOT NULL DEFAULT 100,
  "max_capacity" INTEGER NOT NULL DEFAULT 20,
  "is_active"    BOOLEAN NOT NULL DEFAULT true,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "auto_stands_city_is_active_idx" ON "auto_stands"("city", "is_active");

CREATE TABLE "stand_queue_entries" (
  "id"        UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "driver_id" UUID NOT NULL,
  "stand_id"  UUID NOT NULL,
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stand_queue_entries_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "driver_profiles"("id") ON DELETE CASCADE,
  CONSTRAINT "stand_queue_entries_stand_id_fkey"  FOREIGN KEY ("stand_id")  REFERENCES "auto_stands"("id")      ON DELETE CASCADE,
  CONSTRAINT "stand_queue_entries_driver_id_stand_id_key" UNIQUE ("driver_id", "stand_id")
);

CREATE INDEX "stand_queue_entries_stand_id_joined_at_idx" ON "stand_queue_entries"("stand_id", "joined_at");
