import { Module } from "@nestjs/common";
import { IdempotencyService } from "./idempotency.service";
import { IdempotencyInterceptor } from "./idempotency.interceptor";

/**
 * M30 — Idempotency (Foundation). Safe retries for mutating POSTs.
 * Public API: IdempotencyInterceptor (bind per-route or globally) backed by
 * IdempotencyService. Table `idempotency_keys` owned here (D-015).
 */
@Module({
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
