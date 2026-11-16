import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { OutboxModule } from "./outbox/outbox.module";
import { AuditModule } from "./audit/audit.module";
import { IdempotencyModule } from "./idempotency/idempotency.module";
import { FeatureFlagsModule } from "./feature-flags/feature-flags.module";
import { AuthModule } from "./auth/auth.module";
import { UsersModule } from "./users/users.module";
import { SellersModule } from "./sellers/sellers.module";
import { ShopsModule } from "./shops/shops.module";
import { MediaModule } from "./media/media.module";
import { CatalogModule } from "./catalog/catalog.module";
import { ListingsModule } from "./listings/listings.module";
import { InventoryModule } from "./inventory/inventory.module";

/**
 * Root module. Steps 4–8: Auth · Users · RBAC · Sellers · Shops · Media ·
 * Catalog · Listings · Inventory. One module per folder; cross-module access
 * only via ports/events (D-015).
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
    SellersModule,
    ShopsModule,
    MediaModule,
    CatalogModule,
    ListingsModule,
    InventoryModule,
  ],
})
export class AppModule {}


