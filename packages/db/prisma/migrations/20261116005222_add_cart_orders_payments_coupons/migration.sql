-- CreateTable
CREATE TABLE "carts" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "status" VARCHAR(8) NOT NULL DEFAULT 'OPEN',
    "coupon_code" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" UUID NOT NULL,
    "cart_id" UUID NOT NULL,
    "listing_variant_id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "added_price_paise" BIGINT NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" UUID NOT NULL,
    "scope" VARCHAR(8) NOT NULL,
    "city_id" UUID,
    "shop_id" UUID,
    "code" TEXT NOT NULL,
    "type" VARCHAR(13) NOT NULL,
    "value_bp" INTEGER,
    "value_paise" BIGINT,
    "min_order_paise" BIGINT NOT NULL DEFAULT 0,
    "max_discount_paise" BIGINT,
    "usage_limit" INTEGER,
    "per_user_limit" INTEGER NOT NULL DEFAULT 1,
    "valid_from" TIMESTAMPTZ(3),
    "valid_to" TIMESTAMPTZ(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coupons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_redemptions" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "discount_paise" BIGINT NOT NULL,

    CONSTRAINT "coupon_redemptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "order_no" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "address_snapshot" JSONB NOT NULL,
    "items_total_paise" BIGINT NOT NULL,
    "delivery_total_paise" BIGINT NOT NULL,
    "discount_paise" BIGINT NOT NULL DEFAULT 0,
    "tax_total_paise" BIGINT NOT NULL,
    "grand_total_paise" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "status" VARCHAR(18) NOT NULL DEFAULT 'PENDING_PAYMENT',
    "payment_id" UUID,
    "placed_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "cancellation_reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_orders" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "shop_id" UUID NOT NULL,
    "seller_order_no" TEXT NOT NULL,
    "items_total_paise" BIGINT NOT NULL,
    "delivery_fee_paise" BIGINT NOT NULL,
    "tax_total_paise" BIGINT NOT NULL,
    "commission_paise" BIGINT NOT NULL DEFAULT 0,
    "seller_net_paise" BIGINT NOT NULL DEFAULT 0,
    "status" VARCHAR(17) NOT NULL DEFAULT 'NEW',
    "accept_deadline_at" TIMESTAMPTZ(3),
    "accepted_at" TIMESTAMPTZ(3),
    "rejected_reason" TEXT,
    "delivered_at" TIMESTAMPTZ(3),
    "closed_at" TIMESTAMPTZ(3),

    CONSTRAINT "seller_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "seller_order_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "listing_variant_id" UUID,
    "product_id" UUID,
    "variant_id" UUID,
    "quantity" INTEGER NOT NULL,
    "unit_price_paise" BIGINT NOT NULL,
    "mrp_paise" BIGINT,
    "tax_rate_bp" INTEGER,
    "tax_amount_paise" BIGINT,
    "line_total_paise" BIGINT NOT NULL,
    "name_snapshot" TEXT NOT NULL,
    "sku_snapshot" TEXT NOT NULL,
    "image_media_id" UUID,
    "weight_grams" INTEGER,
    "status" VARCHAR(9) NOT NULL DEFAULT 'NORMAL',

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_events" (
    "id" UUID NOT NULL,
    "order_id" UUID,
    "seller_order_id" UUID,
    "order_item_id" UUID,
    "event" VARCHAR(24) NOT NULL,
    "from_status" TEXT,
    "to_status" TEXT,
    "actor_type" VARCHAR(8) NOT NULL,
    "actor_id" UUID,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "provider" VARCHAR(8) NOT NULL,
    "provider_order_ref" TEXT,
    "amount_paise" BIGINT NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'INR',
    "method" VARCHAR(10),
    "status" VARCHAR(16) NOT NULL DEFAULT 'CREATED',
    "captured_at" TIMESTAMPTZ(3),
    "idempotency_key" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "provider_txn_ref" TEXT,
    "type" VARCHAR(7),
    "status" TEXT,
    "amount_paise" BIGINT,
    "raw_payload" JSONB,
    "signature_verified" BOOLEAN,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" UUID NOT NULL,
    "payment_id" UUID NOT NULL,
    "seller_order_id" UUID,
    "order_item_id" UUID,
    "amount_paise" BIGINT NOT NULL,
    "reason" TEXT,
    "status" VARCHAR(10) NOT NULL DEFAULT 'REQUESTED',
    "provider_ref" TEXT,
    "initiated_by" UUID,
    "completed_at" TIMESTAMPTZ(3),

    CONSTRAINT "refunds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_events" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "event_type" TEXT NOT NULL,
    "external_ref" TEXT NOT NULL,
    "signature_valid" BOOLEAN,
    "raw_payload" JSONB,
    "processed_at" TIMESTAMPTZ(3),
    "processing_error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "carts_user_id_status_idx" ON "carts"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_listing_variant_id_key" ON "cart_items"("cart_id", "listing_variant_id");

-- CreateIndex
CREATE INDEX "coupons_code_idx" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "coupon_redemptions_coupon_id_user_id_idx" ON "coupon_redemptions"("coupon_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_no_key" ON "orders"("order_no");

-- CreateIndex
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");

-- CreateIndex
CREATE INDEX "seller_orders_shop_id_status_idx" ON "seller_orders"("shop_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "seller_orders_shop_id_seller_order_no_key" ON "seller_orders"("shop_id", "seller_order_no");

-- CreateIndex
CREATE INDEX "order_events_order_id_idx" ON "order_events"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_events_provider_event_type_external_ref_key" ON "webhook_events"("provider", "event_type", "external_ref");

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_redemptions" ADD CONSTRAINT "coupon_redemptions_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
