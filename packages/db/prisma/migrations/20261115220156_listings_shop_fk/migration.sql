-- DropIndex
DROP INDEX "products_name_trgm";

-- AddForeignKey
ALTER TABLE "seller_listings" ADD CONSTRAINT "seller_listings_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
