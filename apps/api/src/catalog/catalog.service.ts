import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import {
  validateAttributes,
  normalizeGtin,
  type AttributeSpec,
} from "./catalog.core";

export interface CreateProductInput {
  categoryId: string;
  brandId?: string;
  name: string;
  description?: string;
  gtin?: string;
  attributes?: Record<string, unknown>;
  createdBy?: string;
}

export type MatchOrCreateResult =
  | { ok: true; productId: string; matched: "GTIN" | "CREATED"; matchGroupId?: string }
  | { ok: false; reason: "CATEGORY_NOT_FOUND" | "ATTR_INVALID"; errors?: unknown };

const SIMILARITY_THRESHOLD = 0.75; // spec: trigram ≥ 0.75 → match queue

@Injectable()
export class CatalogService {
  /** Public category tree (active). */
  async categoryTree() {
    const cats = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, parentId: true, name: true, slug: true, pathText: true },
    });
    return cats;
  }

  /**
   * Seller wizard: find existing master by GTIN, else create. On create, snapshot
   * the category attribute schema, validate attributes, and fuzzy-match by name
   * (trigram ≥ 0.75) into a match_group for admin merge (still publishable).
   */
  async matchOrCreate(input: CreateProductInput): Promise<MatchOrCreateResult> {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) return { ok: false, reason: "CATEGORY_NOT_FOUND" };

    // 1) GTIN dedupe — exact match attaches to the existing master.
    const gtin = normalizeGtin(input.gtin);
    if (gtin) {
      const existing = await prisma.product.findUnique({ where: { gtin } });
      if (existing) return { ok: true, productId: existing.id, matched: "GTIN" };
    }

    // 2) Validate attributes against the category schema.
    const schema = (category.attributeSchema as AttributeSpec[] | null) ?? [];
    const attrCheck = validateAttributes(schema, input.attributes ?? {});
    if (!attrCheck.ok) return { ok: false, reason: "ATTR_INVALID", errors: attrCheck.errors };

    // 3) Fuzzy match by name within same category (trigram) → match_group.
    const similar = await prisma.$queryRaw<Array<{ id: string; sim: number }>>`
      SELECT id, similarity(name, ${input.name}) AS sim
      FROM products
      WHERE category_id = ${input.categoryId}::uuid
        AND similarity(name, ${input.name}) >= ${SIMILARITY_THRESHOLD}
      ORDER BY sim DESC LIMIT 1`;

    const slug = `${input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60)}-${Date.now().toString(36)}`;

    return prisma.$transaction(async (tx) => {
      let matchGroupId: string | undefined;
      if (similar.length > 0 && similar[0]) {
        const mg = await tx.matchGroup.create({
          data: {
            status: "OPEN",
            canonicalProductId: similar[0].id,
            similarity: similar[0].sim,
          },
        });
        matchGroupId = mg.id;
      }

      const product = await tx.product.create({
        data: {
          categoryId: input.categoryId,
          brandId: input.brandId ?? null,
          name: input.name,
          slug,
          description: input.description ?? null,
          gtin,
          attributes: (input.attributes ?? {}) as object,
          status: category.requiresApproval ? "PENDING_REVIEW" : "ACTIVE",
          matchGroupId: matchGroupId ?? null,
          createdBy: input.createdBy ?? null,
          categorySchemaSnapshot: schema as object,
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "product",
          aggregateId: product.id,
          eventType: "product.created.v1",
          payload: { productId: product.id, categoryId: input.categoryId, gtin },
        },
      });
      return { ok: true as const, productId: product.id, matched: "CREATED" as const, matchGroupId };
    });
  }

  /** Admin: merge a match group → redirect all listings to the canonical master. */
  async mergeGroup(matchGroupId: string, canonicalProductId: string, adminId: string) {
    return prisma.$transaction(async (tx) => {
      const group = await tx.matchGroup.findUnique({ where: { id: matchGroupId } });
      if (!group) return { ok: false as const, reason: "NOT_FOUND" };

      // redirect listings of the duplicate products to the canonical product
      const dupes = await tx.product.findMany({
        where: { matchGroupId, id: { not: canonicalProductId } },
        select: { id: true },
      });
      for (const dup of dupes) {
        await tx.sellerListing.updateMany({
          where: { productId: dup.id },
          data: { productId: canonicalProductId },
        });
        await tx.product.update({ where: { id: dup.id }, data: { status: "INACTIVE" } });
      }
      await tx.matchGroup.update({
        where: { id: matchGroupId },
        data: { status: "MERGED", canonicalProductId, resolvedBy: adminId },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "product",
          aggregateId: canonicalProductId,
          eventType: "product.merged.v1",
          payload: { canonicalProductId, mergedCount: dupes.length },
        },
      });
      return { ok: true as const, mergedCount: dupes.length };
    });
  }
}
