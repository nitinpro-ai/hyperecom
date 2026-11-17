import { Module } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";
import { AuthModule } from "../auth/auth.module";

/**
 * M25 — Analytics. Owns analytics_events + analytics_rollups. PII-stripped event
 * stream, daily rollups, tenant-scoped dashboards (seller = own shop only).
 */
@Module({
  imports: [AuthModule],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
