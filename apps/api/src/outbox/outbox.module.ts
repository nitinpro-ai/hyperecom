import { Module } from "@nestjs/common";
import { OutboxService } from "./outbox.service";

/**
 * M27 — Outbox. Business row + event in ONE transaction; worker dispatches async.
 * Public API: OutboxService.publish(). Subscribers register handlers per eventType.
 */
@Module({
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
