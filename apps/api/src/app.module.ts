import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { OutboxModule } from "./outbox/outbox.module";
import { AuditModule } from "./audit/audit.module";
import { IdempotencyModule } from "./idempotency/idempotency.module";
import { FeatureFlagsModule } from "./feature-flags/feature-flags.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";

/**
 * Root module. Step 4: Auth + Users + RBAC wired. TenantGuard lands with M05.
 * One module per folder; cross-module access only via ports/events (D-015).
 */
@Module({
  imports: [
    HealthModule,
    OutboxModule,
    AuditModule,
    IdempotencyModule,
    FeatureFlagsModule,
    AuthModule,
    UsersModule,
  ],
})
export class AppModule {}


