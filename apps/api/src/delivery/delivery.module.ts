import { Module } from "@nestjs/common";
import { DeliveryService } from "./delivery.service";
import { RidersService } from "./riders.service";
import { AuthModule } from "../auth/auth.module";

/**
 * M17 Delivery Engine + M18 Delivery Partners. Owns delivery_partners,
 * delivery_partner_zones, delivery_jobs, tracking_events, proof_of_delivery.
 * LogisticsPort pattern → 3PL swap later (D-015). Scoring/OTP in delivery.core.
 */
@Module({
  imports: [AuthModule],
  providers: [DeliveryService, RidersService],
  exports: [DeliveryService, RidersService],
})
export class DeliveryModule {}
