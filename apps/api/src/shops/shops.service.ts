import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { allocateSlug } from "../sellers/sellers.core";

export interface CreateShopInput {
  sellerId: string;
  cityId: string;
  name: string;
  description?: string;
}

export type CreateShopResult =
  | { ok: true; shopId: string; slug: string; host: string }
  | { ok: false; reason: "SELLER_NOT_FOUND" | "SELLER_NOT_APPROVED" | "CITY_NOT_FOUND" };

const ROOT_DOMAIN = process.env.ROOT_DOMAIN ?? "apnacity.com";

/**
 * M05 Shops (tenant root) + M06 shop-domains. create() allocates a unique slug
 * transactionally (collision → -2), provisions the shop + subdomain + settings
 * and emits shop.created.v1 — all in one transaction. suspend() cascades
 * listings → PAUSED (listings arrive with M08; cascade wired then) and emits
 * shop.suspended.v1.
 */
@Injectable()
export class ShopsService {
  async create(input: CreateShopInput): Promise<CreateShopResult> {
    const seller = await prisma.seller.findUnique({ where: { id: input.sellerId } });
    if (!seller) return { ok: false, reason: "SELLER_NOT_FOUND" };
    if (seller.status !== "APPROVED") return { ok: false, reason: "SELLER_NOT_APPROVED" };
    const city = await prisma.city.findUnique({ where: { id: input.cityId } });
    if (!city) return { ok: false, reason: "CITY_NOT_FOUND" };

    return prisma.$transaction(async (tx) => {
      // Transactional slug allocation: read taken slugs sharing the base prefix.
      const base = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 50);
      const rows = await tx.shop.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      });
      const slug = allocateSlug(input.name, new Set(rows.map((r) => r.slug)));
      const host = `${slug}.${ROOT_DOMAIN}`;

      const shop = await tx.shop.create({
        data: {
          sellerId: input.sellerId,
          cityId: input.cityId,
          name: input.name,
          slug,
          description: input.description ?? null,
          status: "ACTIVE",
          openedAt: new Date(),
        },
      });
      await tx.shopDomain.create({
        data: { shopId: shop.id, host, hostType: "SUBDOMAIN", sslStatus: "PENDING" },
      });
      await tx.shopSettings.create({ data: { shopId: shop.id } });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "shop",
          aggregateId: shop.id,
          eventType: "shop.created.v1",
          payload: { shopId: shop.id, slug, cityId: input.cityId },
        },
      });
      return { ok: true as const, shopId: shop.id, slug, host };
    });
  }

  /** Activate a shop (approval cascade target). */
  async activate(shopId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.shop.update({
        where: { id: shopId },
        data: { status: "ACTIVE", openedAt: new Date() },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "shop",
          aggregateId: shopId,
          eventType: "shop.updated.v1",
          payload: { shopId, status: "ACTIVE" },
        },
      });
    });
  }

  /** Suspend → shop SUSPENDED + cascade listings to PAUSED (M08) + event. */
  async suspend(shopId: string, reason: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.shop.update({ where: { id: shopId }, data: { status: "SUSPENDED" } });
      // Listing cascade lands with M08:
      // await tx.sellerListing.updateMany({ where: { shopId }, data: { status: "PAUSED" } });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "shop",
          aggregateId: shopId,
          eventType: "shop.suspended.v1",
          payload: { shopId, reason },
        },
      });
    });
  }

  /** M06 — resolve a storefront host to its tenant (cache 60 s in prod). */
  async resolveBySlug(slug: string) {
    return prisma.shop.findUnique({
      where: { slug },
      select: { id: true, slug: true, cityId: true, status: true, name: true },
    });
  }

  async resolveTenant(host: string) {
    const domain = await prisma.shopDomain.findUnique({
      where: { host },
      select: { shopId: true, shop: { select: { slug: true, cityId: true, status: true } } },
    });
    if (!domain) return null;
    return { shopId: domain.shopId, slug: domain.shop.slug, cityId: domain.shop.cityId };
  }
}
