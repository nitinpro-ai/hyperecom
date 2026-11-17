-- CreateTable
CREATE TABLE "analytics_events" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(20) NOT NULL,
    "city_id" UUID,
    "shop_id" UUID,
    "actor_key" TEXT,
    "payload" JSONB,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_rollups" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "scope" VARCHAR(8) NOT NULL,
    "scope_id" UUID,
    "event_type" VARCHAR(20) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "value_paise" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "analytics_rollups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_event_type_occurred_at_idx" ON "analytics_events"("event_type", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_shop_id_occurred_at_idx" ON "analytics_events"("shop_id", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_events_city_id_occurred_at_idx" ON "analytics_events"("city_id", "occurred_at");

-- CreateIndex
CREATE INDEX "analytics_rollups_scope_scope_id_day_idx" ON "analytics_rollups"("scope", "scope_id", "day");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_rollups_day_scope_scope_id_event_type_key" ON "analytics_rollups"("day", "scope", "scope_id", "event_type");
