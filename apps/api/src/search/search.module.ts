import { Module } from "@nestjs/common";
import { SearchService } from "./search.service";
import { AuthModule } from "../auth/auth.module";

/**
 * M11 — Search & Discovery. FTS + pg_trgm + PostGIS over ACTIVE listings
 * (city-scoped). Owns search_synonyms; results projected from live rows.
 * Same SearchPort an OpenSearch impl would satisfy later (D-015).
 */
@Module({
  imports: [AuthModule],
  providers: [SearchService],
  exports: [SearchService],
})
export class SearchModule {}
