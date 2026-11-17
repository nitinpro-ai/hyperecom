import { Module } from "@nestjs/common";
import { ListingsService } from "./listings.service";
import { ListingsController } from "./listings.controller";
import { ListingsSellerController } from "./listings.seller.controller";
import { AuthModule } from "../auth/auth.module";

/**
 * M08 — Listings. Owns seller_listings/listing_variants/price_history (D-015,
 * tenant tables). Publish once → visible on storefront + marketplace + search.
 */
@Module({
  imports: [AuthModule],
  controllers: [ListingsController, ListingsSellerController],
  providers: [ListingsService],
  exports: [ListingsService],
})
export class ListingsModule {}
