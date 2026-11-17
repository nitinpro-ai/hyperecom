-- CreateTable
CREATE TABLE "webhook_subscriptions" (
    "id" UUID NOT NULL,
    "owner_type" VARCHAR(8) NOT NULL,
    "owner_id" UUID,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "event_types" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(9) NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_status_code" INTEGER,
    "last_error" TEXT,
    "delivered_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "webhook_subscriptions_owner_type_owner_id_idx" ON "webhook_subscriptions"("owner_type", "owner_id");

-- CreateIndex
CREATE INDEX "webhook_deliveries_status_next_attempt_at_idx" ON "webhook_deliveries"("status", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
