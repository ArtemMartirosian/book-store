CREATE TABLE "customers" (
  "id" UUID NOT NULL,
  "phone" VARCHAR(16),
  "google_subject" VARCHAR(255),
  "google_email" VARCHAR(254),
  "full_name" VARCHAR(100) NOT NULL DEFAULT '',
  "locale" VARCHAR(2) NOT NULL DEFAULT 'hy',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customers_identity_check" CHECK ("phone" IS NOT NULL OR "google_subject" IS NOT NULL)
);
CREATE UNIQUE INDEX "customers_phone_key" ON "customers"("phone");
CREATE UNIQUE INDEX "customers_google_subject_key" ON "customers"("google_subject");

CREATE TABLE "customer_sessions" (
  "token_hash" CHAR(64) NOT NULL,
  "customer_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_sessions_pkey" PRIMARY KEY ("token_hash"),
  CONSTRAINT "customer_sessions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "customer_sessions_customer_id_idx" ON "customer_sessions"("customer_id");
CREATE INDEX "customer_sessions_expires_at_idx" ON "customer_sessions"("expires_at");

CREATE TABLE "customer_challenges" (
  "id" UUID NOT NULL,
  "phone" VARCHAR(16) NOT NULL,
  "customer_id" UUID,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  CONSTRAINT "customer_challenges_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "customer_challenges_expires_at_idx" ON "customer_challenges"("expires_at");

CREATE TABLE "customer_oauth_flows" (
  "state_hash" CHAR(64) NOT NULL,
  "code_verifier" VARCHAR(128) NOT NULL,
  "nonce" VARCHAR(64) NOT NULL,
  "locale" VARCHAR(2) NOT NULL,
  "customer_id" UUID,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_oauth_flows_pkey" PRIMARY KEY ("state_hash")
);
CREATE INDEX "customer_oauth_flows_expires_at_idx" ON "customer_oauth_flows"("expires_at");

CREATE TABLE "customer_auth_rates" (
  "key" VARCHAR(128) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_auth_rates_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "customer_auth_rates_expires_at_idx" ON "customer_auth_rates"("expires_at");

CREATE TABLE "customer_addresses" (
  "id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "label" VARCHAR(40) NOT NULL,
  "full_name" VARCHAR(100) NOT NULL,
  "phone" VARCHAR(16) NOT NULL,
  "district" VARCHAR(32) NOT NULL,
  "address_line" VARCHAR(200) NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_addresses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_addresses_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "customer_addresses_customer_id_created_at_idx" ON "customer_addresses"("customer_id", "created_at");
CREATE UNIQUE INDEX "customer_addresses_one_default" ON "customer_addresses"("customer_id") WHERE "is_default" = true;

ALTER TABLE "orders" ADD COLUMN "customer_id" UUID;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "orders_customer_id_created_at_id_idx" ON "orders"("customer_id", "created_at" DESC, "id" DESC);
