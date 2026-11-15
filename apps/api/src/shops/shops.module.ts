import { Module } from "@nestjs/common";
import { ShopsService } from "./shops.service";
import { ShopsController } from "./shops.controller";
import { AuthModule } from "../auth/auth.module";

/**
 * M05 Shops (tenant root) + M06 shop-domains. Owns shops/shop_settings/
 * shop_domains (D-015). Imports AuthModule for the JWT guard on POST /shops.
 */
@Module({
  imports: [AuthModule],
  controllers: [ShopsController],
  providers: [ShopsService],
  exports: [ShopsService],
})
export class ShopsModule {}
