-- Denní rate-limit AI poradce: 10 dotazů/den/uživatel (spec §6 P1)
CREATE TABLE "advisor_usage" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "advisor_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "advisor_usage_user_id_day_key" ON "advisor_usage"("user_id", "day");

ALTER TABLE "advisor_usage"
  ADD CONSTRAINT "advisor_usage_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
