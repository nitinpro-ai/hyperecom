import { Module } from "@nestjs/common";
import { WebhooksService } from "./webhooks.service";
import { AuthModule } from "../auth/auth.module";

/**
 * M28 — Outbound webhooks. Owns webhook_subscriptions + webhook_deliveries.
 * HMAC-signed payloads, retries 1m/5m/30m/2h/6h → DEAD. processPending → CronJob.
 */
@Module({
  imports: [AuthModule],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
