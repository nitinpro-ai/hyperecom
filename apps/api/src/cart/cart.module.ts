import { Module } from "@nestjs/common";
import { CartService } from "./cart.service";
import { AuthModule } from "../auth/auth.module";

/** M12 — Cart. Owns carts/cart_items (D-015). */
@Module({
  imports: [AuthModule],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
