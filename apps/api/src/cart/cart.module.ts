import { Module } from "@nestjs/common";
import { CartService } from "./cart.service";
import { CartController } from "./cart.controller";
import { AuthModule } from "../auth/auth.module";

/** M12 — Cart. Owns carts/cart_items (D-015). */
@Module({
  imports: [AuthModule],
  controllers: [CartController],
  providers: [CartService],
  exports: [CartService],
})
export class CartModule {}
