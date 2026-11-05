import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";

/**
 * Root module. Step 4 adds: ConfigModule(global), PrismaModule, AuthModule,
 * UsersModule, TenantGuard — see COMPLETE-BUILD-GUIDE PART II (M01, M02, M27…).
 * One module per folder; cross-module access only via ports/events (D-015).
 */
@Module({
  imports: [HealthModule],
})
export class AppModule {}
