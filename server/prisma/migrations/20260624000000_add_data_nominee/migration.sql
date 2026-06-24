-- DPDP Act 2023 §14 — Right to Nomination
-- Stores one nominee per user who can exercise data rights on their behalf

CREATE TABLE "data_nominees" (
    "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
    "user_id"      UUID         NOT NULL,
    "name"         VARCHAR(100) NOT NULL,
    "phone"        VARCHAR(15)  NOT NULL,
    "relationship" VARCHAR(50),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "data_nominees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "data_nominees_user_id_key" ON "data_nominees"("user_id");

ALTER TABLE "data_nominees"
    ADD CONSTRAINT "data_nominees_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
