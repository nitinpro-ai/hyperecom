import { Module } from "@nestjs/common";
import { InventoryService } from "./inventory.service";
import { AuthModule } from "../auth/auth.module";

/**
 * M09 — Inventory. The single stock authority (D-015). Owns inventory_locations,
 * stock, stock_movements (append-only), stock_reservations. Atomic conditional
 * UPDATE is the only mutation path — prevents oversell under concurrency.
 */
@Module({
  imports: [AuthModule],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
