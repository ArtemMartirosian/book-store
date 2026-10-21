BEGIN;
ALTER TABLE "customers" ADD COLUMN "email" VARCHAR(254);
ALTER TABLE "customers" ADD COLUMN "password_hash" VARCHAR(512);
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
ALTER TABLE "customers" DROP CONSTRAINT "customers_identity_check";
ALTER TABLE "customers" ADD CONSTRAINT "customers_identity_check" CHECK (
  "phone" IS NOT NULL OR "google_subject" IS NOT NULL OR ("email" IS NOT NULL AND "password_hash" IS NOT NULL)
);
ALTER TABLE "customers" ADD CONSTRAINT "customers_password_identity_pair" CHECK (
  ("email" IS NULL AND "password_hash" IS NULL) OR ("email" IS NOT NULL AND "password_hash" IS NOT NULL)
);
ALTER TABLE "customers" ADD CONSTRAINT "customers_email_normalized" CHECK (
  "email" IS NULL OR ("email" = lower(btrim("email")) AND length("email") > 3)
);
COMMIT;
