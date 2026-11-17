import { Body, Controller, Delete, Get, Inject, Param, Patch, Post, HttpException, UseGuards } from "@nestjs/common";
import { CartService } from "./cart.service";
import { JwtAuthGuard, CurrentUser } from "../auth/auth.guard";
import type { AccessClaims } from "../auth/auth.crypto";

interface AddItemDto { cityId: string; listingVariantId: string; listingId: string; shopId: string; quantity: number }
interface QtyDto { quantity: number }

/** M12 — cart HTTP. Authed; userId from the JWT. */
@Controller()
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(@Inject(CartService) private readonly cart: CartService) {}

  @Get("cart")
  get(@CurrentUser() u: AccessClaims) {
    return this.cart.getCart(u.sub);
  }

  @Post("cart/items")
  async add(@CurrentUser() u: AccessClaims, @Body() dto: AddItemDto) {
    const r = await this.cart.addItem({ userId: u.sub, ...dto });
    if (!r.ok) throw new HttpException(r.reason, r.reason === "LISTING_NOT_FOUND" ? 404 : 409);
    return { cartId: r.cartId };
  }

  @Patch("cart/items/:id")
  async updateQty(@Param("id") id: string, @Body() dto: QtyDto) {
    await this.cart.updateQty(id, dto.quantity);
    return { ok: true };
  }

  @Delete("cart/items/:id")
  async remove(@Param("id") id: string) {
    await this.cart.removeItem(id);
    return { ok: true };
  }
}
