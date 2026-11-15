-- CreateTable
CREATE TABLE "sellers" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "legal_name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "business_type" VARCHAR(13) NOT NULL,
    "pan" VARCHAR(10) NOT NULL,
    "gstin" VARCHAR(15),
    "status" VARCHAR(12) NOT NULL DEFAULT 'DRAFT',
    "kyc_submitted_at" TIMESTAMPTZ(3),
    "approved_at" TIMESTAMPTZ(3),
    "approved_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_accounts" (
    "id" UUID NOT NULL,
    "owner_type" VARCHAR(15) NOT NULL,
    "owner_id" UUID NOT NULL,
    "holder_name" TEXT NOT NULL,
    "account_no_enc" TEXT NOT NULL,
    "ifsc" VARCHAR(11) NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_documents" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "doc_type" VARCHAR(20) NOT NULL,
    "media_id" UUID,
    "status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "verified_by" UUID,
    "note" TEXT,

    CONSTRAINT "kyc_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shops" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_media_id" UUID,
    "banner_media_id" UUID,
    "description" TEXT,
    "category_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "status" VARCHAR(9) NOT NULL DEFAULT 'PENDING',
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "rating_count" INTEGER NOT NULL DEFAULT 0,
    "opened_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shops_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_domains" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "host" TEXT NOT NULL,
    "host_type" VARCHAR(10) NOT NULL DEFAULT 'SUBDOMAIN',
    "verified_at" TIMESTAMPTZ(3),
    "ssl_status" VARCHAR(8) NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "shop_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shop_settings" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "delivery_mode" VARCHAR(9) NOT NULL DEFAULT 'BOTH',
    "pickup_address_id" UUID,
    "opening_hours" JSONB,
    "return_policy_text" TEXT,
    "min_order_paise" BIGINT NOT NULL DEFAULT 0,
    "commission_rate_override" DECIMAL(5,2),
    "locale" VARCHAR(2) NOT NULL DEFAULT 'EN',
    "theme" JSONB,

    CONSTRAINT "shop_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sellers_user_id_key" ON "sellers"("user_id");

-- CreateIndex
CREATE INDEX "bank_accounts_owner_type_owner_id_idx" ON "bank_accounts"("owner_type", "owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "shops_slug_key" ON "shops"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "shop_domains_shop_id_key" ON "shop_domains"("shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "shop_domains_host_key" ON "shop_domains"("host");

-- CreateIndex
CREATE UNIQUE INDEX "shop_settings_shop_id_key" ON "shop_settings"("shop_id");

-- AddForeignKey
ALTER TABLE "sellers" ADD CONSTRAINT "sellers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kyc_documents" ADD CONSTRAINT "kyc_documents_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shops" ADD CONSTRAINT "shops_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_domains" ADD CONSTRAINT "shop_domains_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shop_settings" ADD CONSTRAINT "shop_settings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
