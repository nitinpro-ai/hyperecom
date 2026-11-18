import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import {
  isValidPan,
  isValidGstin,
  nextStatus,
  type SellerStatus,
  type KycAction,
} from "./sellers.core";

export interface RegisterSellerInput {
  userId: string;
  legalName: string;
  displayName: string;
  businessType: string;
  pan: string;
  gstin?: string;
}

export type RegisterResult =
  | { ok: true; sellerId: string }
  | { ok: false; reason: "INVALID_PAN" | "INVALID_GSTIN" | "ALREADY_REGISTERED" };

export type KycResult =
  | { ok: true; status: SellerStatus }
  | { ok: false; reason: "NOT_FOUND" | "ILLEGAL_TRANSITION" };

/**
 * M04 — Sellers & KYC. Registration, KYC submission, admin approval machine.
 * State machine in sellers.core; events via outbox; approval cascade activates
 * the seller's shops (handled with M05 ShopsService on shop.created).
 */
@Injectable()
export class SellersService {
  async register(input: RegisterSellerInput): Promise<RegisterResult> {
    if (!isValidPan(input.pan)) return { ok: false, reason: "INVALID_PAN" };
    if (input.gstin && !isValidGstin(input.gstin)) return { ok: false, reason: "INVALID_GSTIN" };

    const existing = await prisma.seller.findUnique({ where: { userId: input.userId } });
    if (existing) return { ok: false, reason: "ALREADY_REGISTERED" };

    const seller = await prisma.seller.create({
      data: {
        userId: input.userId,
        legalName: input.legalName,
        displayName: input.displayName,
        businessType: input.businessType,
        pan: input.pan,
        gstin: input.gstin ?? null,
        status: "DRAFT",
      },
    });
    return { ok: true, sellerId: seller.id };
  }

  async submitKyc(sellerId: string): Promise<KycResult> {
    return this.transition(sellerId, "SUBMIT", (tx, seller) =>
      tx.outboxEvent.create({
        data: {
          aggregateType: "seller",
          aggregateId: seller.id,
          eventType: "kyc.submitted.v1",
          payload: { sellerId: seller.id },
        },
      }),
      { kycSubmittedAt: new Date() },
    );
  }

  /** Resolve the seller owned by a user, then submit KYC. */
  async submitKycForUser(userId: string): Promise<KycResult> {
    const seller = await prisma.seller.findUnique({ where: { userId } });
    if (!seller) return { ok: false, reason: "NOT_FOUND" };
    return this.submitKyc(seller.id);
  }

  /** Admin approve → emits kyc.approved.v1 (ShopsService activates shops on it). */
  async approve(sellerId: string, adminUserId: string): Promise<KycResult> {
    return this.transition(sellerId, "APPROVE", (tx, seller) =>
      tx.outboxEvent.create({
        data: {
          aggregateType: "seller",
          aggregateId: seller.id,
          eventType: "kyc.approved.v1",
          payload: { sellerId: seller.id },
        },
      }),
      { approvedAt: new Date(), approvedBy: adminUserId },
    );
  }

  async reject(sellerId: string): Promise<KycResult> {
    return this.transition(sellerId, "REJECT");
  }

  async suspend(sellerId: string): Promise<KycResult> {
    return this.transition(sellerId, "SUSPEND");
  }

  /** Ensure the user holds SELLER_OWNER so @Roles("SELLER_OWNER") routes succeed. */
  async ensureSellerOwnerRole(userId: string): Promise<void> {
    let role = await prisma.role.findUnique({ where: { name: "SELLER_OWNER" } });
    if (!role) {
      role = await prisma.role.create({ data: { name: "SELLER_OWNER" } });
    }
    const existing = await prisma.userRole.findFirst({ where: { userId, roleId: role.id } });
    if (!existing) {
      await prisma.userRole.create({ data: { userId, roleId: role.id } });
    }
  }

  /** Dev/self-service instant approval: transitions/sets seller to APPROVED + activates shops. */
  async devApproveForUser(userId: string): Promise<{ ok: true; sellerId: string; status: SellerStatus } | { ok: false; reason: "NOT_FOUND" }> {
    const seller = await prisma.seller.findUnique({ where: { userId } });
    if (!seller) return { ok: false, reason: "NOT_FOUND" };
    await this.ensureSellerOwnerRole(userId);
    if (seller.status !== "APPROVED") {
      await prisma.$transaction(async (tx) => {
        await tx.seller.update({
          where: { id: seller.id },
          data: {
            status: "APPROVED",
            kycSubmittedAt: seller.kycSubmittedAt ?? new Date(),
            approvedAt: new Date(),
            approvedBy: userId,
          },
        });
        await tx.shop.updateMany({
          where: { sellerId: seller.id, status: "PENDING" },
          data: { status: "ACTIVE", openedAt: new Date() },
        });
        await tx.outboxEvent.create({
          data: {
            aggregateType: "seller",
            aggregateId: seller.id,
            eventType: "kyc.approved.v1",
            payload: { sellerId: seller.id, devApproved: true },
          },
        });
      });
    } else {
      await prisma.shop.updateMany({
        where: { sellerId: seller.id, status: "PENDING" },
        data: { status: "ACTIVE", openedAt: new Date() },
      });
    }
    return { ok: true, sellerId: seller.id, status: "APPROVED" };
  }

  /** Seller Studio overview: seller profile, shops (with counts), cities, and KPIs. */
  async getOverview(userId: string) {
    const [user, seller, cities] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true, phone: true, roles: { select: { role: { select: { name: true } } } } },
      }),
      prisma.seller.findUnique({
        where: { userId },
        include: {
          shops: {
            orderBy: { openedAt: "desc" },
            include: {
              city: { select: { id: true, name: true, slug: true } },
              domain: { select: { host: true, hostType: true, sslStatus: true } },
              _count: { select: { listings: true } },
            },
          },
        },
      }),
      prisma.city.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: { id: true, name: true, slug: true, state: { select: { name: true, code: true } } },
      }),
    ]);

    if (seller) await this.ensureSellerOwnerRole(userId);

    const shopIds = seller?.shops.map((s) => s.id) ?? [];
    const [listings, orders] = shopIds.length
      ? await Promise.all([
          prisma.sellerListing.findMany({ where: { shopId: { in: shopIds } }, select: { id: true, shopId: true, status: true } }),
          prisma.sellerOrder.findMany({ where: { shopId: { in: shopIds } }, select: { id: true, shopId: true, status: true, itemsTotalPaise: true, sellerNetPaise: true } }),
        ])
      : [[], []];

    const revenuePaise = orders.filter((o) => !["REJECTED", "CANCELLED", "RETURNED"].includes(o.status)).reduce((acc, o) => acc + Number(o.itemsTotalPaise), 0);
    const pendingOrders = orders.filter((o) => ["NEW", "ACCEPTED", "PREPARING", "READY"].includes(o.status)).length;
    const activeListings = listings.filter((l) => l.status === "ACTIVE").length;

    return {
      user: user
        ? { id: user.id, name: user.name, email: user.email, phone: user.phone, roles: Array.from(new Set([...user.roles.map((r) => r.role.name), ...(seller ? ["SELLER_OWNER"] : [])])) }
        : null,
      seller: seller
        ? { id: seller.id, legalName: seller.legalName, displayName: seller.displayName, businessType: seller.businessType, pan: seller.pan, gstin: seller.gstin, status: seller.status, kycSubmittedAt: seller.kycSubmittedAt, approvedAt: seller.approvedAt, createdAt: seller.createdAt }
        : null,
      shops: (seller?.shops ?? []).map((s) => {
        const shopOrders = orders.filter((o) => o.shopId === s.id);
        const shopRevenue = shopOrders.filter((o) => !["REJECTED", "CANCELLED", "RETURNED"].includes(o.status)).reduce((a, o) => a + Number(o.itemsTotalPaise), 0);
        return { id: s.id, name: s.name, slug: s.slug, description: s.description, status: s.status, cityId: s.cityId, cityName: s.city.name, citySlug: s.city.slug, host: s.domain?.host ?? `${s.slug}.apnacity.com`, listingCount: s._count.listings, orderCount: shopOrders.length, revenuePaise: shopRevenue };
      }),
      cities: cities.map((c) => ({ id: c.id, name: c.name, slug: c.slug, stateName: c.state.name, stateCode: c.state.code })),
      stats: { revenuePaise, activeListings, totalListings: listings.length, pendingOrders, totalOrders: orders.length },
    };
  }
  /** List all listings + variants + stock for a seller's shops. */
  async listSellerListings(userId: string, shopId?: string) {
    const seller = await prisma.seller.findUnique({
      where: { userId },
      include: { shops: { select: { id: true, name: true, slug: true } } },
    });
    if (!seller) return [];
    const allowedShopIds = seller.shops.map((s) => s.id);
    const filterShopIds = shopId && allowedShopIds.includes(shopId) ? [shopId] : allowedShopIds;
    if (!filterShopIds.length) return [];

    const rows = await prisma.sellerListing.findMany({
      where: { shopId: { in: filterShopIds } },
      orderBy: { listedAt: "desc" },
      include: {
        shop: { select: { id: true, name: true, slug: true } },
        product: {
          select: { id: true, name: true, slug: true, gtin: true, category: { select: { id: true, name: true } } },
        },
        variants: { orderBy: { sellerSku: "asc" } },
      },
    });

    const lvIds = rows.flatMap((r) => r.variants.map((v) => v.id));
    const stocks = lvIds.length ? await prisma.stock.findMany({ where: { listingVariantId: { in: lvIds } } }) : [];
    const stockByLv = new Map<string, { onHand: number; reserved: number }>();
    for (const st of stocks) {
      const prev = stockByLv.get(st.listingVariantId) ?? { onHand: 0, reserved: 0 };
      stockByLv.set(st.listingVariantId, {
        onHand: prev.onHand + st.quantityOnHand,
        reserved: prev.reserved + st.quantityReserved,
      });
    }

    return rows.map((r) => {
      const v = r.variants[0];
      const st = v ? stockByLv.get(v.id) : undefined;
      return {
        listingId: r.id,
        shopId: r.shopId,
        shopName: r.shop.name,
        shopSlug: r.shop.slug,
        productId: r.productId,
        title: r.titleOverride ?? r.product.name,
        productSlug: r.product.slug,
        gtin: r.product.gtin,
        categoryId: r.product.category.id,
        categoryName: r.product.category.name,
        status: r.status,
        listedAt: r.listedAt,
        listingVariantId: v?.id ?? null,
        variantId: v?.variantId ?? null,
        sellerSku: v?.sellerSku ?? "—",
        mrpPaise: v ? Number(v.mrpPaise) : 0,
        pricePaise: v ? Number(v.pricePaise) : 0,
        stockOnHand: st?.onHand ?? 0,
        stockReserved: st?.reserved ?? 0,
      };
    });
  }
  /** Inline-update a seller listing's price, MRP, stock, or status. */
  async updateSellerListing(
    userId: string,
    listingId: string,
    dto: { pricePaise?: number; mrpPaise?: number; stockOnHand?: number; status?: "ACTIVE" | "PAUSED" },
  ) {
    const seller = await prisma.seller.findUnique({ where: { userId }, include: { shops: { select: { id: true } } } });
    if (!seller) return { ok: false as const, reason: "NOT_SELLER" };
    const shopIds = new Set(seller.shops.map((s) => s.id));

    const listing = await prisma.sellerListing.findUnique({ where: { id: listingId }, include: { variants: true } });
    if (!listing || !shopIds.has(listing.shopId)) return { ok: false as const, reason: "NOT_FOUND" };

    const v = listing.variants[0];
    if (v && (dto.pricePaise != null || dto.mrpPaise != null)) {
      const newMrp = dto.mrpPaise != null ? dto.mrpPaise : Number(v.mrpPaise);
      const newPrice = dto.pricePaise != null ? dto.pricePaise : Number(v.pricePaise);
      if (newPrice > newMrp || newPrice <= 0) return { ok: false as const, reason: "PRICE_GT_MRP" };
      await prisma.$transaction([
        prisma.listingVariant.update({ where: { id: v.id }, data: { pricePaise: BigInt(newPrice), mrpPaise: BigInt(newMrp) } }),
        prisma.priceHistory.create({ data: { listingVariantId: v.id, pricePaise: BigInt(newPrice), changedBy: userId, reason: "seller-portal-edit" } }),
      ]);
    }

    if (v && dto.stockOnHand != null && dto.stockOnHand >= 0) {
      let loc = await prisma.inventoryLocation.findFirst({ where: { shopId: listing.shopId, isDefault: true } });
      if (!loc) loc = await prisma.inventoryLocation.create({ data: { shopId: listing.shopId, name: "Shop Floor", isDefault: true } });
      const existingStock = await prisma.stock.findUnique({ where: { locationId_listingVariantId: { locationId: loc.id, listingVariantId: v.id } } });
      const minHand = existingStock?.quantityReserved ?? 0;
      const targetHand = Math.max(minHand, Math.round(dto.stockOnHand));
      if (existingStock) {
        await prisma.stock.update({ where: { id: existingStock.id }, data: { quantityOnHand: targetHand } });
      } else {
        await prisma.stock.create({ data: { locationId: loc.id, listingVariantId: v.id, quantityOnHand: targetHand, quantityReserved: 0 } });
      }
    }

    if (dto.status && (dto.status === "ACTIVE" || dto.status === "PAUSED")) {
      await prisma.sellerListing.update({
        where: { id: listing.id },
        data: { status: dto.status, ...(dto.status === "ACTIVE" ? { listedAt: new Date() } : {}) },
      });
    }
    return { ok: true as const };
  }

  /** List all SellerOrders for the seller's shops. */
  async listSellerOrders(userId: string, shopId?: string) {
    const seller = await prisma.seller.findUnique({ where: { userId }, include: { shops: { select: { id: true, name: true, slug: true } } } });
    if (!seller) return [];
    const shopMap = new Map(seller.shops.map((s) => [s.id, s]));
    const allowedShopIds = seller.shops.map((s) => s.id);
    const filterShopIds = shopId && allowedShopIds.includes(shopId) ? [shopId] : allowedShopIds;
    if (!filterShopIds.length) return [];

    const rows = await prisma.sellerOrder.findMany({
      where: { shopId: { in: filterShopIds } },
      orderBy: { order: { createdAt: "desc" } },
      take: 100,
      include: {
        order: { select: { id: true, orderNo: true, createdAt: true, placedAt: true, addressSnapshot: true } },
        items: { select: { id: true, nameSnapshot: true, skuSnapshot: true, quantity: true, unitPricePaise: true, lineTotalPaise: true } },
      },
    });

    return rows.map((so) => ({
      id: so.id,
      sellerOrderNo: so.sellerOrderNo,
      orderId: so.orderId,
      orderNo: so.order.orderNo,
      shopId: so.shopId,
      shopName: shopMap.get(so.shopId)?.name ?? "Shop",
      status: so.status,
      itemsTotalPaise: Number(so.itemsTotalPaise),
      deliveryFeePaise: Number(so.deliveryFeePaise),
      taxTotalPaise: Number(so.taxTotalPaise),
      sellerNetPaise: Number(so.sellerNetPaise),
      createdAt: so.order.createdAt,
      placedAt: so.order.placedAt,
      acceptedAt: so.acceptedAt,
      deliveredAt: so.deliveredAt,
      addressSnapshot: so.order.addressSnapshot,
      items: so.items.map((it) => ({
        id: it.id,
        name: it.nameSnapshot,
        sku: it.skuSnapshot,
        quantity: it.quantity,
        unitPricePaise: Number(it.unitPricePaise),
        lineTotalPaise: Number(it.lineTotalPaise),
      })),
    }));
  }

  /** Generic guarded transition: validates via the state machine in one tx. */
  private async transition(
    sellerId: string,
    action: KycAction,
    sideEffect?: (tx: typeof prisma, seller: { id: string }) => Promise<unknown>,
    extraData: Record<string, unknown> = {},
  ): Promise<KycResult> {
    return prisma.$transaction(async (tx) => {
      const seller = await tx.seller.findUnique({ where: { id: sellerId } });
      if (!seller) return { ok: false, reason: "NOT_FOUND" as const };

      const to = nextStatus(seller.status as SellerStatus, action);
      if (!to) return { ok: false, reason: "ILLEGAL_TRANSITION" as const };

      await tx.seller.update({ where: { id: sellerId }, data: { status: to, ...extraData } });
      if (sideEffect) await sideEffect(tx as unknown as typeof prisma, seller);
      return { ok: true, status: to };
    });
  }
}
