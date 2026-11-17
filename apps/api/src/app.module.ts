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
import { CartModule } from "./cart/cart.module";
import { CheckoutModule } from "./checkout/checkout.module";
import { PaymentsModule } from "./payments/payments.module";
import { OrdersModule } from "./orders/orders.module";
import { DeliveryModule } from "./delivery/delivery.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ReturnsModule } from "./returns/returns.module";
import { SupportModule } from "./support/support.module";
import { FinanceModule } from "./finance/finance.module";
import { InvoicingModule } from "./invoicing/invoicing.module";
import { SearchModule } from "./search/search.module";
import { AdminModule } from "./admin/admin.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { WebhooksModule } from "./webhooks/webhooks.module";
import { ReviewsModule } from "./reviews/reviews.module";
import { ContentModule } from "./content/content.module";

/**
 * Root module — ApnaCity API, ALL 32 modules (M01–M32).
 * Cross-module access only via ports/events (D-015).
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
    CartModule,
    CheckoutModule,
    PaymentsModule,
    OrdersModule,
    DeliveryModule,
    NotificationsModule,
    ReturnsModule,
    SupportModule,
    FinanceModule,
    InvoicingModule,
    SearchModule,
    AdminModule,
    AnalyticsModule,
    WebhooksModule,
    ReviewsModule,
    ContentModule,
  ],
})
export class AppModule {}


