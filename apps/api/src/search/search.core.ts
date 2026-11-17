/**
 * M11 search — pure helpers: query normalisation, sort mapping, result ranking.
 * The SQL lives in search.service; these are the testable decision bits.
 */

export type SortKey = "relevance" | "price_asc" | "price_desc" | "nearest" | "fastest" | "rating";

export interface SearchFilters {
  cityId?: string;
  category?: string;
  brand?: string;
  minPrice?: number; // paise
  maxPrice?: number;
  shopId?: string;
  inStock?: boolean;
  minRating?: number;
  sort?: SortKey;
}

/** Normalise the raw query for FTS (lowercase, trim, collapse, strip punctuation). */
export function normalizeQuery(q: string): string {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

/** Expand a query with synonyms (term → synonyms) for the FTS OR-group. */
export function expandSynonyms(q: string, synonyms: Record<string, string[]>): string[] {
  const words = normalizeQuery(q).split(" ").filter(Boolean);
  const out = new Set<string>(words);
  for (const w of words) for (const s of synonyms[w] ?? []) out.add(s);
  return [...out];
}

/** Map a sort key to an ORDER BY clause (whitelisted — never interpolate user input). */
export function orderByClause(sort: SortKey = "relevance"): string {
  switch (sort) {
    case "price_asc": return "price_paise ASC";
    case "price_desc": return "price_paise DESC";
    case "nearest": return "distance_m ASC NULLS LAST";
    case "fastest": return "eta_minutes ASC NULLS LAST";
    case "rating": return "rating_avg DESC";
    case "relevance":
    default: return "relevance DESC";
  }
}

export interface Rankable {
  relevance: number; // 0..1 FTS/trigram similarity
  inStock: boolean;
  ratingAvg: number; // 0..5
  sponsored?: boolean;
}

/** Composite relevance score: relevance × in-stock × rating, sponsored boosted but labelled. */
export function rankScore(r: Rankable): number {
  const stock = r.inStock ? 1 : 0.3; // out-of-stock heavily demoted, not removed
  const rating = 0.6 + (r.ratingAvg / 5) * 0.4; // 0.6..1.0
  const base = r.relevance * stock * rating;
  return r.sponsored ? base * 1.25 : base;
}

/** Typo tolerance: is the trigram similarity above the acceptance floor? */
export function acceptsTypo(similarity: number, floor = 0.3): boolean {
  return similarity >= floor;
}
