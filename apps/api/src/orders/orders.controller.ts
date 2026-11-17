import { Body, Controller, Get, Inject, Param, Post, HttpException, UseGuards } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { OrdersService } from "./orders.service";
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from "../auth/auth.guard";
import type { AccessClaims } from "../auth/auth.crypto";
import type { ChildAction } from "./orders.core";

const SELLER_ACTIONS: Record<string, ChildAction> = {
  accept: "ACCEPT", reject: "REJECT", preparing: "PREPARING", ready: "READY", dispatch: "DISPATCH",
};

/** M14 — orders HTTP. Customer reads own orders; seller transitions their child orders. */
@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(@Inject(OrdersService) private readonly orders: OrdersService) {}

  @Get("orders")
  async myOrders(@CurrentUser() u: AccessClaims) {
    return prisma.order.findMany({
      where: { userId: u.sub },
      orderBy: { createdAt: "desc" }, take: 50,
      select: { id: true, orderNo: true, status: true, grandTotalPaise: true, createdAt: true, placedAt: true },
    });
  }

  @Get("orders/:id")
  async orderDetail(@CurrentUser() u: AccessClaims, @Param("id") id: string) {
    const order = await prisma.order.findFirst({
      where: { id, userId: u.sub },
      select: {
        id: true, orderNo: true, status: true, grandTotalPaise: true, itemsTotalPaise: true,
        deliveryTotalPaise: true, addressSnapshot: true, createdAt: true, placedAt: true,
        sellerOrders: { select: { id: true, shopId: true, status: true, itemsTotalPaise: true } },
        items: { select: { nameSnapshot: true, quantity: true, unitPricePaise: true, lineTotalPaise: true } },
      },
    });
    if (!order) throw new HttpException("order not found", 404);
    return order;
  }

  @Post("orders/:id/cancel")
  async cancel(@CurrentUser() u: AccessClaims, @Param("id") id: string, @Body() dto: { reason: string }) {
    const r = await this.orders.cancelOrder(id, u.sub, dto.reason ?? "customer cancel");
    if (!r.ok) throw new HttpException(r.reason ?? "cannot cancel", r.code ?? 409);
    return { ok: true };
  }

  @Post("seller-orders/:id/:action")
  @UseGuards(RolesGuard)
  @Roles("SELLER_OWNER", "SELLER_STAFF", "SUPER_ADMIN")
  async sellerTransition(@CurrentUser() u: AccessClaims, @Param("id") id: string, @Param("action") action: string, @Body() dto: { reason?: string }) {
    const act = SELLER_ACTIONS[action];
    if (!act) throw new HttpException("unknown action", 400);
    const r = await this.orders.transition(id, act, "SELLER", u.sub, dto?.reason);
    if (!r.ok) throw new HttpException(r.reason, r.code);
    return { status: r.status, parentStatus: r.parentStatus };
  }
}
