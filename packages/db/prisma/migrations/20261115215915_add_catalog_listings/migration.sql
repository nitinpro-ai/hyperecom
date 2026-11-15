-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "path_text" TEXT NOT NULL,
    "attribute_schema" JSONB,
    "icon_media_id" UUID,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "return_window_days" INTEGER NOT NULL DEFAULT 7,
    "is_non_returnable" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logo_media_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "brand_id" UUID,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "gtin" VARCHAR(14),
    "attributes" JSONB,
    "status" VARCHAR(15) NOT NULL DEFAULT 'DRAFT',
    "match_group_id" UUID,
    "created_by" UUID,
    "category_schema_snapshot" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "sku" TEXT,
    "attributes" JSONB NOT NULL,
    "weight_grams" INTEGER,
    "dimensions_mm" JSONB,
    "barcode" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_media" (
    "id" UUID NOT NULL,
    "product_id" UUID,
    "variant_id" UUID,
    "shop_id" UUID,
    "media_id" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "product_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_groups" (
    "id" UUID NOT NULL,
    "status" VARCHAR(9) NOT NULL DEFAULT 'OPEN',
    "canonical_product_id" UUID,
    "similarity" DECIMAL(4,3),
    "resolved_by" UUID,

    CONSTRAINT "match_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_listings" (
    "id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "title_override" TEXT,
    "status" VARCHAR(13) NOT NULL DEFAULT 'DRAFT',
    "listed_at" TIMESTAMPTZ(3),
    "deactivated_at" TIMESTAMPTZ(3),

    CONSTRAINT "seller_listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listing_variants" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "seller_sku" TEXT NOT NULL,
    "mrp_paise" BIGINT NOT NULL,
    "price_paise" BIGINT NOT NULL,
    "tax_rate_bp" INTEGER NOT NULL DEFAULT 0,
    "stock_tracked" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "listing_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_history" (
    "id" UUID NOT NULL,
    "listing_variant_id" UUID NOT NULL,
    "price_paise" BIGINT NOT NULL,
    "changed_by" UUID,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brands_slug_key" ON "brands"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_key" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "products_gtin_key" ON "products"("gtin");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "product_media_product_id_idx" ON "product_media"("product_id");

-- CreateIndex
CREATE INDEX "seller_listings_shop_id_status_idx" ON "seller_listings"("shop_id", "status");

-- CreateIndex
CREATE INDEX "seller_listings_product_id_status_idx" ON "seller_listings"("product_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "seller_listings_shop_id_product_id_key" ON "seller_listings"("shop_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "listing_variants_listing_id_variant_id_key" ON "listing_variants"("listing_id", "variant_id");

-- CreateIndex
CREATE UNIQUE INDEX "listing_variants_shop_id_seller_sku_key" ON "listing_variants"("shop_id", "seller_sku");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_listings" ADD CONSTRAINT "seller_listings_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_variants" ADD CONSTRAINT "listing_variants_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "seller_listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listing_variants" ADD CONSTRAINT "listing_variants_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_history" ADD CONSTRAINT "price_history_listing_variant_id_fkey" FOREIGN KEY ("listing_variant_id") REFERENCES "listing_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
