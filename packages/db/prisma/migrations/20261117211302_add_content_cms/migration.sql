-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "city_id" UUID,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "meta_title" TEXT,
    "meta_desc" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" UUID NOT NULL,
    "city_id" UUID,
    "title" TEXT NOT NULL,
    "image_media_id" UUID,
    "link_url" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active_from" TIMESTAMPTZ(3),
    "active_to" TIMESTAMPTZ(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" UUID NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pages_slug_key" ON "pages"("slug");

-- CreateIndex
CREATE INDEX "pages_city_id_is_published_idx" ON "pages"("city_id", "is_published");

-- CreateIndex
CREATE INDEX "banners_city_id_is_active_idx" ON "banners"("city_id", "is_active");

-- CreateIndex
CREATE INDEX "faqs_category_is_active_idx" ON "faqs"("category", "is_active");
