-- CreateTable
CREATE TABLE "countries" (
    "id" UUID NOT NULL,
    "iso_code" VARCHAR(2) NOT NULL,
    "name" TEXT NOT NULL,
    "phone_code" VARCHAR(5),

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "states" (
    "id" UUID NOT NULL,
    "country_id" UUID NOT NULL,
    "code" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "state_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "center" geometry(Point, 4326),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "localities" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "boundary" geometry(MultiPolygon, 4326),

    CONSTRAINT "localities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pincodes" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "pincode" VARCHAR(6) NOT NULL,
    "is_serviceable" BOOLEAN NOT NULL DEFAULT true,
    "boundary" geometry(MultiPolygon, 4326),

    CONSTRAINT "pincodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "zone_type" VARCHAR(13) NOT NULL,
    "radius_m" INTEGER,
    "fee_paise" BIGINT NOT NULL,
    "free_above_paise" BIGINT,
    "eta_min_minutes" INTEGER NOT NULL,
    "eta_max_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "center" geometry(Point, 4326),
    "boundary" geometry(MultiPolygon, 4326),

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocode_cache" (
    "cache_key" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "formatted" TEXT,
    "fetched_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("cache_key")
);

-- CreateIndex
CREATE UNIQUE INDEX "countries_iso_code_key" ON "countries"("iso_code");

-- CreateIndex
CREATE UNIQUE INDEX "states_country_id_code_key" ON "states"("country_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cities_slug_key" ON "cities"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "localities_city_id_slug_key" ON "localities"("city_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "pincodes_pincode_key" ON "pincodes"("pincode");

-- AddForeignKey
ALTER TABLE "states" ADD CONSTRAINT "states_country_id_fkey" FOREIGN KEY ("country_id") REFERENCES "countries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_state_id_fkey" FOREIGN KEY ("state_id") REFERENCES "states"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "localities" ADD CONSTRAINT "localities_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pincodes" ADD CONSTRAINT "pincodes_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_zones" ADD CONSTRAINT "delivery_zones_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- M03 PostGIS / spec additions (not expressible in schema.prisma)
-- Spec: COMPLETE-BUILD-GUIDE PART II M03.
-- ---------------------------------------------------------------------------

-- ltree extension (hierarchical paths; spec declares postgis + pg_trgm + ltree)
CREATE EXTENSION IF NOT EXISTS ltree;

-- zone_type domain constraint (CIRCLE_RADIUS | POLYGON)
ALTER TABLE "delivery_zones"
  ADD CONSTRAINT "delivery_zones_zone_type_check"
  CHECK ("zone_type" IN ('CIRCLE_RADIUS', 'POLYGON'));

-- Spatial indexes (GiST) — hot paths for detect()/serviceability
CREATE INDEX "geo_cities_center" ON "cities" USING gist ("center");
CREATE INDEX "geo_zones" ON "delivery_zones" USING gist (COALESCE("boundary", "center"));
