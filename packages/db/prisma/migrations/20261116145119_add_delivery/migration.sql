-- CreateTable
CREATE TABLE "delivery_partners" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "vehicle" VARCHAR(8) NOT NULL,
    "kyc_status" VARCHAR(9) NOT NULL DEFAULT 'PENDING',
    "bank_account_id" UUID,
    "is_available" BOOLEAN NOT NULL DEFAULT false,
    "last_location" geometry(Point, 4326),
    "last_seen_at" TIMESTAMPTZ(3),
    "current_job_id" UUID,
    "rating_avg" DECIMAL(3,2) NOT NULL DEFAULT 5,
    "rating_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "delivery_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_partner_zones" (
    "id" UUID NOT NULL,
    "delivery_partner_id" UUID NOT NULL,
    "locality_id" UUID NOT NULL,

    CONSTRAINT "delivery_partner_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_jobs" (
    "id" UUID NOT NULL,
    "seller_order_id" UUID NOT NULL,
    "type" VARCHAR(13) NOT NULL DEFAULT 'FORWARD',
    "mode" VARCHAR(14) NOT NULL,
    "status" VARCHAR(18) NOT NULL DEFAULT 'UNASSIGNED',
    "delivery_partner_id" UUID,
    "pickup_location" geometry(Point, 4326) NOT NULL,
    "drop_location" geometry(Point, 4326) NOT NULL,
    "distance_m" INTEGER,
    "fee_paise" BIGINT,
    "eta_minutes" INTEGER,
    "otp_hash" TEXT,
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "assignment_reason" JSONB,
    "assigned_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "picked_up_at" TIMESTAMPTZ(3),
    "delivered_at" TIMESTAMPTZ(3),
    "failed_reason" TEXT,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delivery_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracking_events" (
    "id" UUID NOT NULL,
    "delivery_job_id" UUID NOT NULL,
    "delivery_partner_id" UUID,
    "event" VARCHAR(14) NOT NULL,
    "location" geometry(Point, 4326),
    "payload" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tracking_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proof_of_delivery" (
    "id" UUID NOT NULL,
    "delivery_job_id" UUID NOT NULL,
    "media_id" UUID,
    "otp_verified" BOOLEAN,
    "signature_media_id" UUID,
    "signed_by_name" TEXT,
    "delivered_to_relation" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proof_of_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "delivery_partners_user_id_key" ON "delivery_partners"("user_id");

-- CreateIndex
CREATE INDEX "delivery_partners_city_id_is_available_idx" ON "delivery_partners"("city_id", "is_available");

-- CreateIndex
CREATE INDEX "delivery_jobs_status_idx" ON "delivery_jobs"("status");

-- CreateIndex
CREATE INDEX "delivery_jobs_seller_order_id_idx" ON "delivery_jobs"("seller_order_id");

-- CreateIndex
CREATE INDEX "tracking_events_delivery_job_id_idx" ON "tracking_events"("delivery_job_id");

-- AddForeignKey
ALTER TABLE "delivery_partner_zones" ADD CONSTRAINT "delivery_partner_zones_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_jobs" ADD CONSTRAINT "delivery_jobs_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_delivery_job_id_fkey" FOREIGN KEY ("delivery_job_id") REFERENCES "delivery_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proof_of_delivery" ADD CONSTRAINT "proof_of_delivery_delivery_job_id_fkey" FOREIGN KEY ("delivery_job_id") REFERENCES "delivery_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
