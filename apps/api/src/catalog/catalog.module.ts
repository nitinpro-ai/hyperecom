import { Module } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { AuthModule } from "../auth/auth.module";

/**
 * M07 — Catalog. Owns categories/brands/products/product_variants/
 * product_media/match_groups (D-015). Shared master so many shops offer the
 * same product and compare like-for-like.
 */
@Module({
  imports: [AuthModule],
  providers: [CatalogService],
  exports: [CatalogService],
})
export class CatalogModule {}
