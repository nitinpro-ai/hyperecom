import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { OutboxModule } from "./outbox/outbox.module";

/**
 * Root module. Step 4 adds: PrismaModule, AuthModule, UsersModule, TenantGuard.
 * One module per folder; cross-module access only via ports/events (D-015).
 */
@Module({
  imports: [HealthModule, OutboxModule],
})
export class AppModule {}

