CREATE TYPE "RideType" AS ENUM ('PASSENGER', 'PARCEL');

ALTER TABLE "rides"
  ADD COLUMN "ride_type"          "RideType" NOT NULL DEFAULT 'PASSENGER',
  ADD COLUMN "parcel_description" VARCHAR(255),
  ADD COLUMN "recipient_name"     VARCHAR(100),
  ADD COLUMN "recipient_phone"    VARCHAR(15);

ALTER TABLE "driver_profiles"
  ADD COLUMN "accepts_parcels" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "fare_configs"
  ADD COLUMN "parcel_surcharge" DOUBLE PRECISION NOT NULL DEFAULT 20;
