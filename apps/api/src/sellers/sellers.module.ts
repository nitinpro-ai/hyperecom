import { Module } from "@nestjs/common";
import { SellersService } from "./sellers.service";
import { SellersController } from "./sellers.controller";
import { AuthModule } from "../auth/auth.module";

/**
 * M04 — Sellers & KYC. Owns sellers/kyc_documents/bank_accounts (D-015).
 * Imports AuthModule for JwtAuthGuard/RolesGuard on seller + admin routes.
 */
@Module({
  imports: [AuthModule],
  controllers: [SellersController],
  providers: [SellersService],
  exports: [SellersService],
})
export class SellersModule {}
