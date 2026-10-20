-- CreateEnum
CREATE TYPE "BaseUnit" AS ENUM ('G', 'ML', 'PCS');

-- CreateEnum
CREATE TYPE "PricingMode" AS ENUM ('PACKAGE', 'WEIGHT');

-- CreateEnum
CREATE TYPE "LeafletSource" AS ENUM ('SEED', 'MANUAL', 'IMPORT', 'SCRAPE');

-- CreateEnum
CREATE TYPE "PromotionScope" AS ENUM ('CHAIN', 'STORE');

-- CreateEnum
CREATE TYPE "AliasSource" AS ENUM ('SEED', 'USER', 'AI');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('RESOLVED_AUTO', 'RESOLVED_CONFIRMED', 'SUGGESTED', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "MatchMethod" AS ENUM ('EXACT', 'ALIAS', 'TRIGRAM', 'AI', 'USER', 'NONE');

-- CreateEnum
CREATE TYPE "HouseholdRole" AS ENUM ('OWNER', 'MEMBER');

-- CreateEnum
CREATE TYPE "PlanKind" AS ENUM ('FREE', 'PREMIUM');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('MANUAL', 'STRIPE', 'REVENUECAT');

-- CreateEnum
CREATE TYPE "PriceHistorySource" AS ENUM ('PROMO', 'REGULAR');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('IOS', 'ANDROID');

-- CreateTable
CREATE TABLE "chains" (
    "id" UUID NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "country_code" CHAR(2) NOT NULL DEFAULT 'CZ',
    "color_hex" CHAR(7) NOT NULL,
    "logo_url" TEXT,
    "is_mvp" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "legal_approved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "chains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "address" VARCHAR(255) NOT NULL,
    "city" VARCHAR(128) NOT NULL,
    "zip" VARCHAR(8),
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leaflets" (
    "id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE NOT NULL,
    "source" "LeafletSource" NOT NULL,
    "source_url" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checksum" CHAR(64) NOT NULL,

    CONSTRAINT "leaflets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "canonical_name" VARCHAR(255) NOT NULL,
    "brand" VARCHAR(128),
    "category" VARCHAR(64) NOT NULL DEFAULT 'Ostatní',
    "base_unit" "BaseUnit" NOT NULL,
    "package_amount" DECIMAL(10,3) NOT NULL,
    "pricing_mode" "PricingMode" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_aliases" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "alias" VARCHAR(255) NOT NULL,
    "source" "AliasSource" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promotions" (
    "id" UUID NOT NULL,
    "leaflet_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "store_id" UUID,
    "scope" "PromotionScope" NOT NULL DEFAULT 'CHAIN',
    "price_minor" INTEGER NOT NULL,
    "regular_price_minor" INTEGER,
    "package_amount" DECIMAL(10,3) NOT NULL,
    "package_unit" "BaseUnit" NOT NULL,
    "pricing_mode" "PricingMode" NOT NULL,
    "unit_price_minor" INTEGER NOT NULL,
    "note" VARCHAR(255),

    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history_points" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "price_minor" INTEGER NOT NULL,
    "unit_price_minor" INTEGER NOT NULL,
    "package_amount" DECIMAL(10,3) NOT NULL,
    "package_unit" "BaseUnit" NOT NULL,
    "source" "PriceHistorySource" NOT NULL,

    CONSTRAINT "price_history_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history_monthly" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "chain_id" UUID NOT NULL,
    "month" DATE NOT NULL,
    "min_unit_price_minor" INTEGER NOT NULL,
    "avg_unit_price_minor" INTEGER NOT NULL,
    "max_unit_price_minor" INTEGER NOT NULL,
    "sample_days" INTEGER NOT NULL,

    CONSTRAINT "price_history_monthly_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(128),
    "locale" VARCHAR(8) NOT NULL DEFAULT 'cs-CZ',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" UUID NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "owner_user_id" UUID NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "HouseholdRole" NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_invitations" (
    "id" UUID NOT NULL,
    "household_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "household_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" "PlanKind" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "current_period_end" TIMESTAMP(3),
    "provider" "SubscriptionProvider" NOT NULL DEFAULT 'MANUAL',
    "provider_subscription_id" VARCHAR(128),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(255) NOT NULL,
    "platform" "Platform" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_lists" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "household_id" UUID,
    "name" VARCHAR(64) NOT NULL DEFAULT 'Můj nákup',
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopping_list_items" (
    "id" UUID NOT NULL,
    "list_id" UUID NOT NULL,
    "raw_text" VARCHAR(255) NOT NULL,
    "product_id" UUID,
    "quantity_base" DECIMAL(10,3) NOT NULL,
    "base_unit" "BaseUnit" NOT NULL,
    "match_status" "MatchStatus" NOT NULL,
    "match_method" "MatchMethod" NOT NULL,
    "match_confidence" DECIMAL(3,2),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "chain_id" UUID,
    "target_unit_price_minor" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chains_code_key" ON "chains"("code");

-- CreateIndex
CREATE INDEX "stores_latitude_longitude_idx" ON "stores"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "stores_chain_id_address_key" ON "stores"("chain_id", "address");

-- CreateIndex
CREATE INDEX "leaflets_valid_from_valid_to_idx" ON "leaflets"("valid_from", "valid_to");

-- CreateIndex
CREATE UNIQUE INDEX "leaflets_chain_id_valid_from_valid_to_key" ON "leaflets"("chain_id", "valid_from", "valid_to");

-- CreateIndex
CREATE UNIQUE INDEX "products_canonical_name_brand_key" ON "products"("canonical_name", "brand");

-- CreateIndex
CREATE INDEX "product_aliases_alias_idx" ON "product_aliases"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "product_aliases_product_id_alias_key" ON "product_aliases"("product_id", "alias");

-- CreateIndex
CREATE INDEX "promotions_product_id_chain_id_idx" ON "promotions"("product_id", "chain_id");

-- CreateIndex
CREATE INDEX "promotions_chain_id_idx" ON "promotions"("chain_id");

-- CreateIndex
CREATE UNIQUE INDEX "promotions_leaflet_id_product_id_store_id_key" ON "promotions"("leaflet_id", "product_id", "store_id");

-- CreateIndex
CREATE INDEX "price_history_points_product_id_date_idx" ON "price_history_points"("product_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "price_history_points_product_id_chain_id_date_key" ON "price_history_points"("product_id", "chain_id", "date");

-- CreateIndex
CREATE INDEX "price_history_monthly_product_id_month_idx" ON "price_history_monthly"("product_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "price_history_monthly_product_id_chain_id_month_key" ON "price_history_monthly"("product_id", "chain_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_household_id_user_id_key" ON "household_members"("household_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "household_invitations_token_hash_key" ON "household_invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_provider_provider_subscription_id_key" ON "subscriptions"("provider", "provider_subscription_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_tokens_token_key" ON "push_tokens"("token");

-- CreateIndex
CREATE INDEX "shopping_lists_owner_user_id_idx" ON "shopping_lists"("owner_user_id");

-- CreateIndex
CREATE INDEX "shopping_list_items_list_id_sort_order_idx" ON "shopping_list_items"("list_id", "sort_order");

-- CreateIndex
CREATE INDEX "shopping_list_items_product_id_idx" ON "shopping_list_items"("product_id");

-- CreateIndex
CREATE INDEX "price_alerts_user_id_is_active_idx" ON "price_alerts"("user_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "price_alerts_user_id_product_id_chain_id_key" ON "price_alerts"("user_id", "product_id", "chain_id");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leaflets" ADD CONSTRAINT "leaflets_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_leaflet_id_fkey" FOREIGN KEY ("leaflet_id") REFERENCES "leaflets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history_points" ADD CONSTRAINT "price_history_points_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history_points" ADD CONSTRAINT "price_history_points_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history_monthly" ADD CONSTRAINT "price_history_monthly_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history_monthly" ADD CONSTRAINT "price_history_monthly_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "households" ADD CONSTRAINT "households_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_invitations" ADD CONSTRAINT "household_invitations_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_chain_id_fkey" FOREIGN KEY ("chain_id") REFERENCES "chains"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================================
-- Ruční doplňky (Prisma neumí vyjádřit) — spec §9.5, §9.7, §14.5
-- =====================================================================

-- Fuzzy hledání a porovnávání bez diakritiky (spec §12)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- unaccent() není IMMUTABLE, proto obal, který lze použít v generovaném sloupci i indexu
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

ALTER TABLE "products"
  ADD COLUMN "search_text" text
  GENERATED ALWAYS AS (
    lower(immutable_unaccent(coalesce("canonical_name", '') || ' ' || coalesce("brand", '')))
  ) STORED;

CREATE INDEX "products_search_text_trgm_idx" ON "products" USING gin ("search_text" gin_trgm_ops);
CREATE INDEX "product_aliases_alias_trgm_idx" ON "product_aliases" USING gin ("alias" gin_trgm_ops);

-- Celořetězcové akce (store_id IS NULL) musí být unikátní; Postgres jinak NULLy ignoruje
CREATE UNIQUE INDEX "promotions_leaflet_product_chain_scope_key"
  ON "promotions" ("leaflet_id", "product_id")
  WHERE "store_id" IS NULL;

-- Kontrolní constrainty (spec §9)
ALTER TABLE "leaflets" ADD CONSTRAINT "leaflets_validity_check" CHECK ("valid_to" >= "valid_from");
ALTER TABLE "products" ADD CONSTRAINT "products_package_amount_check" CHECK ("package_amount" > 0);
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_price_check" CHECK ("price_minor" > 0);
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_package_amount_check" CHECK ("package_amount" > 0);
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_unit_price_check" CHECK ("unit_price_minor" > 0);
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_regular_price_check"
  CHECK ("regular_price_minor" IS NULL OR "regular_price_minor" > "price_minor");
ALTER TABLE "promotions" ADD CONSTRAINT "promotions_store_scope_check"
  CHECK (("scope" = 'STORE' AND "store_id" IS NOT NULL) OR ("scope" = 'CHAIN' AND "store_id" IS NULL));
ALTER TABLE "price_history_points" ADD CONSTRAINT "price_history_price_check" CHECK ("price_minor" > 0);
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_target_check" CHECK ("target_unit_price_minor" > 0);
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_quantity_check" CHECK ("quantity_base" > 0);
ALTER TABLE "stores" ADD CONSTRAINT "stores_latitude_check" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "stores" ADD CONSTRAINT "stores_longitude_check" CHECK ("longitude" BETWEEN -180 AND 180);

