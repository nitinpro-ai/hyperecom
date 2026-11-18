import { Injectable } from "@nestjs/common";
import { prisma, Prisma } from "@apnacity/db";
import { normalizeQuery, orderByClause, type SearchFilters, type SortKey } from "./search.core";

export interface SearchHit {
  productId: string;
  name: string;
  shopId: string;
  listingVariantId: string;
  pricePaise: number;
  mrpPaise: number;
  inStock: boolean;
  relevance: number;
}

/**
 * M11 — Search. Postgres FTS (products_fts GIN) + pg_trgm typo tolerance over
 * ACTIVE listings, city-scoped. Same SearchPort OpenSearch would implement later.
 * The query combines full-text rank with trigram similarity so "nkie" finds Nike.
 */
@Injectable()
export class SearchService {
  async query(q: string, filters: SearchFilters = {}, limit = 30): Promise<SearchHit[]> {
    const norm = normalizeQuery(q);
    if (!norm) return this.browse(filters, limit);
    const order = Prisma.raw(orderByClause(filters.sort ?? "relevance"));
    const words = norm.split(" ").filter(Boolean);
    const tsq = words.join(" | "); // OR terms for recall
    // strongest per-word fuzzy match (typo tolerance): a single well-matched word
    // (e.g. "shoos"→"Shoes") carries the hit even if another word matches weakly.
    const perWord = Prisma.join(words.map((w) => Prisma.sql`word_similarity(${w}, p.name)`), ", ");

    const rows = await prisma.$queryRaw<Array<{
      product_id: string; name: string; shop_id: string; listing_variant_id: string;
      price_paise: bigint; mrp_paise: bigint; in_stock: boolean; relevance: number;
    }>>`
      SELECT p.id AS product_id, p.name,
             sl.shop_id, lv.id AS listing_variant_id,
             lv.price_paise, lv.mrp_paise,
             COALESCE((st.quantity_on_hand - st.quantity_reserved) > 0, false) AS in_stock,
             GREATEST(
               ts_rank(to_tsvector('simple', p.name || ' ' || coalesce(p.description,'')), to_tsquery('simple', ${tsq})),
               GREATEST(${perWord})
             )::float8 AS relevance
      FROM products p
      JOIN seller_listings sl ON sl.product_id = p.id AND sl.status = 'ACTIVE'
      JOIN listing_variants lv ON lv.listing_id = sl.id AND lv.is_active = true
      JOIN shops sh ON sh.id = sl.shop_id AND sh.status = 'ACTIVE'
      LEFT JOIN stock st ON st.listing_variant_id = lv.id
      WHERE p.status = 'ACTIVE'
        AND (
          to_tsvector('simple', p.name || ' ' || coalesce(p.description,'')) @@ to_tsquery('simple', ${tsq})
          OR GREATEST(${perWord}) >= 0.4
        )
        AND (${filters.cityId ?? null}::uuid IS NULL OR sh.city_id = ${filters.cityId ?? null}::uuid)
        AND (${filters.shopId ?? null}::uuid IS NULL OR sh.id = ${filters.shopId ?? null}::uuid)
        AND (${filters.minPrice ?? null}::bigint IS NULL OR lv.price_paise >= ${filters.minPrice ?? null}::bigint)
        AND (${filters.maxPrice ?? null}::bigint IS NULL OR lv.price_paise <= ${filters.maxPrice ?? null}::bigint)
      ORDER BY ${order}
      LIMIT ${limit}`;

    let hits = rows.map((r) => ({
      productId: r.product_id, name: r.name, shopId: r.shop_id,
      listingVariantId: r.listing_variant_id, pricePaise: Number(r.price_paise),
      mrpPaise: Number(r.mrp_paise), inStock: r.in_stock, relevance: Number(r.relevance),
    }));
    if (filters.inStock) hits = hits.filter((h) => h.inStock);
    return hits;
  }

  /**
   * Browse (empty query): list ACTIVE listings by filters only — city/shop/price
   * — ordered by the same whitelisted ORDER BY. Powers the "All" category chip
   * and shop browse (/search?shopId=…), which previously returned nothing. For
   * the default relevance sort there is no text score, so fall back to newest.
   */
  private async browse(filters: SearchFilters = {}, limit = 30): Promise<SearchHit[]> {
    const sort = filters.sort ?? "relevance";
    const order = Prisma.raw(sort === "relevance" ? "lv.id DESC" : orderByClause(sort));
    const rows = await prisma.$queryRaw<Array<{
      product_id: string; name: string; shop_id: string; listing_variant_id: string;
      price_paise: bigint; mrp_paise: bigint; in_stock: boolean;
    }>>`
      SELECT p.id AS product_id, p.name,
             sl.shop_id, lv.id AS listing_variant_id,
             lv.price_paise, lv.mrp_paise,
             COALESCE((st.quantity_on_hand - st.quantity_reserved) > 0, false) AS in_stock
      FROM products p
      JOIN seller_listings sl ON sl.product_id = p.id AND sl.status = 'ACTIVE'
      JOIN listing_variants lv ON lv.listing_id = sl.id AND lv.is_active = true
      JOIN shops sh ON sh.id = sl.shop_id AND sh.status = 'ACTIVE'
      LEFT JOIN stock st ON st.listing_variant_id = lv.id
      WHERE p.status = 'ACTIVE'
        AND (${filters.cityId ?? null}::uuid IS NULL OR sh.city_id = ${filters.cityId ?? null}::uuid)
        AND (${filters.shopId ?? null}::uuid IS NULL OR sh.id = ${filters.shopId ?? null}::uuid)
        AND (${filters.minPrice ?? null}::bigint IS NULL OR lv.price_paise >= ${filters.minPrice ?? null}::bigint)
        AND (${filters.maxPrice ?? null}::bigint IS NULL OR lv.price_paise <= ${filters.maxPrice ?? null}::bigint)
      ORDER BY ${order}
      LIMIT ${limit}`;
    let hits = rows.map((r) => ({
      productId: r.product_id, name: r.name, shopId: r.shop_id,
      listingVariantId: r.listing_variant_id, pricePaise: Number(r.price_paise),
      mrpPaise: Number(r.mrp_paise), inStock: r.in_stock, relevance: 0,
    }));
    if (filters.inStock) hits = hits.filter((h) => h.inStock);
    return hits;
  }

  /** Autocomplete suggestions (≤8) by trigram similarity on product names. */
  async suggest(q: string, limit = 8): Promise<string[]> {
    const norm = normalizeQuery(q);
    if (norm.length < 2) return [];
    const rows = await prisma.$queryRaw<Array<{ name: string }>>`
      SELECT p.name, MAX(similarity(p.name, ${norm})) AS sim
      FROM products p
      WHERE p.status = 'ACTIVE' AND similarity(p.name, ${norm}) >= 0.2
      GROUP BY p.name
      ORDER BY sim DESC
      LIMIT ${limit}`;
    return rows.map((r) => r.name);
  }

  async setSynonym(term: string, synonyms: string[], locale = "EN") {
    await prisma.searchSynonym.upsert({
      where: { term_locale: { term, locale } },
      update: { synonyms }, create: { term, synonyms, locale },
    });
  }
}
