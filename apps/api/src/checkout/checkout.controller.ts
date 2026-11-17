import { Body, Controller, Inject, Post, HttpException, UseGuards } from "@nestjs/common";
import { CheckoutService } from "./checkout.service";
import { JwtAuthGuard, CurrentUser } from "../auth/auth.guard";
import type { AccessClaims } from "../auth/auth.crypto";

interface QuoteDto { deliveryFeePaiseByShop?: Record<string, number>; discountPaise?: number }
interface PlaceDto { cityId: string; addressSnapshot: Record<string, unknown>; deliveryFeePaiseByShop?: Record<string, number>; discountPaise?: number }

/** M13 — checkout HTTP. Authed; userId from the JWT. */
@Controller()
@UseGuards(JwtAuthGuard)
export class CheckoutController {
  constructor(@Inject(CheckoutService) private readonly checkout: CheckoutService) {}

  @Post("checkout/quote")
  async quote(@CurrentUser() u: AccessClaims, @Body() dto: QuoteDto) {
    const q = await this.checkout.quote(u.sub, dto.deliveryFeePaiseByShop ?? {}, dto.discountPaise ?? 0);
    if (!q) throw new HttpException("NO_OPEN_CART", 404);
    return q;
  }

  @Post("orders")
  async place(@CurrentUser() u: AccessClaims, @Body() dto: PlaceDto) {
    const r = await this.checkout.placeOrder({ userId: u.sub, cityId: dto.cityId, addressSnapshot: dto.addressSnapshot, deliveryFeePaiseByShop: dto.deliveryFeePaiseByShop, discountPaise: dto.discountPaise });
    if (!r.ok) {
      if (r.reason === "INSUFFICIENT_STOCK") throw new HttpException({ error: "INSUFFICIENT_STOCK", shortfalls: r.shortfalls }, 422);
      throw new HttpException(r.reason, 409);
    }
    return { orderId: r.orderId, orderNo: r.orderNo, sellerOrderCount: r.sellerOrderCount, grandTotalPaise: r.grandTotalPaise };
  }
}
