import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";

const MAX_ITEMS = 50;
const MAX_SHOPS = 10;

export interface AddItemInput {
  userId: string;
  cityId: string;
  listingVariantId: string;
  listingId: string;
  shopId: string;
  quantity: number;
}

export type AddResult =
  | { ok: true; cartId: string }
  | { ok: false; reason: "TOO_MANY_ITEMS" | "TOO_MANY_SHOPS" | "LISTING_NOT_FOUND" };

@Injectable()
export class CartService {
  /** Get or create the user's single OPEN cart. */
  private async openCart(userId: string, cityId: string) {
    const existing = await prisma.cart.findFirst({ where: { userId, status: "OPEN" } });
    if (existing) return existing;
    return prisma.cart.create({ data: { userId, cityId, status: "OPEN" } });
  }

  async addItem(input: AddItemInput): Promise<AddResult> {
    const lv = await prisma.listingVariant.findUnique({
      where: { id: input.listingVariantId },
      select: { pricePaise: true, listingId: true, shopId: true },
    });
    if (!lv) return { ok: false, reason: "LISTING_NOT_FOUND" };

    const cart = await this.openCart(input.userId, input.cityId);
    const items = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    const shops = new Set(items.map((i) => i.shopId));
    const existingItem = items.find((i) => i.listingVariantId === input.listingVariantId);

    if (!existingItem && items.length >= MAX_ITEMS) return { ok: false, reason: "TOO_MANY_ITEMS" };
    if (!existingItem && !shops.has(input.shopId) && shops.size >= MAX_SHOPS) return { ok: false, reason: "TOO_MANY_SHOPS" };

    if (existingItem) {
      await prisma.cartItem.update({ where: { id: existingItem.id }, data: { quantity: existingItem.quantity + input.quantity } });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id, listingVariantId: input.listingVariantId, listingId: lv.listingId,
          shopId: lv.shopId, quantity: input.quantity, addedPricePaise: lv.pricePaise,
        },
      });
    }
    return { ok: true, cartId: cart.id };
  }

  /** Get cart with per-item price-drift revalidation (snapshot vs current). */
  async getCart(userId: string) {
    const cart = await prisma.cart.findFirst({ where: { userId, status: "OPEN" } });
    if (!cart) return { cartId: null, items: [], itemsTotalPaise: 0, hasDrift: false };

    const items = await prisma.cartItem.findMany({ where: { cartId: cart.id } });
    const lvIds = items.map((i) => i.listingVariantId);
    const current = await prisma.listingVariant.findMany({
      where: { id: { in: lvIds } },
      select: { id: true, pricePaise: true, isActive: true },
    });
    const byId = new Map(current.map((c) => [c.id, c]));

    let hasDrift = false;
    const out = items.map((i) => {
      const cur = byId.get(i.listingVariantId);
      const currentPrice = cur ? Number(cur.pricePaise) : null;
      const drift = currentPrice != null && currentPrice !== Number(i.addedPricePaise);
      const unavailable = !cur || !cur.isActive;
      if (drift || unavailable) hasDrift = true;
      return {
        id: i.id, listingVariantId: i.listingVariantId, shopId: i.shopId, quantity: i.quantity,
        addedPricePaise: Number(i.addedPricePaise), currentPricePaise: currentPrice,
        drift, unavailable,
      };
    });
    const itemsTotalPaise = out.reduce((s, i) => s + (i.currentPricePaise ?? i.addedPricePaise) * i.quantity, 0);
    return { cartId: cart.id, items: out, itemsTotalPaise, hasDrift };
  }

  async updateQty(itemId: string, quantity: number): Promise<void> {
    if (quantity <= 0) { await prisma.cartItem.delete({ where: { id: itemId } }).catch(() => undefined); return; }
    await prisma.cartItem.update({ where: { id: itemId }, data: { quantity } });
  }

  async removeItem(itemId: string): Promise<void> {
    await prisma.cartItem.delete({ where: { id: itemId } }).catch(() => undefined);
  }

  /** Merge an anonymous cart's items into the user's cart at login. */
  async mergeAnonymous(userId: string, cityId: string, anonItems: AddItemInput[]): Promise<void> {
    for (const it of anonItems) await this.addItem({ ...it, userId, cityId });
  }
}
