import { Controller, Get, Inject, Query } from "@nestjs/common";
import { SearchService } from "./search.service";
import type { SearchFilters, SortKey } from "./search.core";

/** M11 — search HTTP (public). */
@Controller()
export class SearchController {
  constructor(@Inject(SearchService) private readonly search: SearchService) {}

  @Get("search")
  async query(
    @Query("q") q: string,
    @Query("cityId") cityId?: string,
    @Query("shopId") shopId?: string,
    @Query("minPrice") minPrice?: string,
    @Query("maxPrice") maxPrice?: string,
    @Query("inStock") inStock?: string,
    @Query("sort") sort?: string,
  ) {
    const filters: SearchFilters = {
      cityId: cityId || undefined,
      shopId: shopId || undefined,
      minPrice: minPrice ? Number.parseInt(minPrice, 10) : undefined,
      maxPrice: maxPrice ? Number.parseInt(maxPrice, 10) : undefined,
      inStock: inStock === "true" ? true : undefined,
      sort: (sort as SortKey) || undefined,
    };
    return this.search.query(q ?? "", filters);
  }

  @Get("search/suggest")
  suggest(@Query("q") q: string) {
    return this.search.suggest(q ?? "");
  }
}
