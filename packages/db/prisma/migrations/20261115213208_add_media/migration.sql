-- CreateTable
CREATE TABLE "media" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "shop_id" UUID,
    "kind" VARCHAR(14) NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime" VARCHAR(30) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "size_bytes" INTEGER NOT NULL,
    "variants" JSONB,
    "scan_status" VARCHAR(9) NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_shop_id_idx" ON "media"("shop_id");

-- CreateIndex
CREATE INDEX "media_owner_user_id_idx" ON "media"("owner_user_id");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
