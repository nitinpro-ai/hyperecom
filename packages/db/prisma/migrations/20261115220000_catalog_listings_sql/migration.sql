-- M07/M08 SQL additions (not expressible in schema.prisma).
-- Spec: PART II M07 (FTS + trigram) / M08 (price<=MRP) + tenant RLS.

-- Full-text search index on products (spec: products_fts).
CREATE INDEX IF NOT EXISTS products_fts
  ON products USING gin (to_tsvector('simple', name || ' ' || coalesce(description, '')));

-- Trigram index for fuzzy product matching (name + fuzzy search).
CREATE INDEX IF NOT EXISTS products_name_trgm ON products USING gin (name gin_trgm_ops);

-- price must never exceed MRP (spec M08 CHECK).
ALTER TABLE "listing_variants"
  ADD CONSTRAINT "listing_variants_price_lte_mrp" CHECK ("price_paise" <= "mrp_paise");

-- Tenant isolation on the two tenant tables (seller_listings, listing_variants).
-- Same model as shops_tenant_rls: shop_id must match app.current_tenant GUC,
-- or admin bypass. app role without tenant context sees 0 rows.
ALTER TABLE "seller_listings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seller_listings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "listing_variants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "listing_variants" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "seller_listings"
  USING (
    current_setting('app.is_admin', true) = 'on'
    OR shop_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON "listing_variants"
  USING (
    current_setting('app.is_admin', true) = 'on'
    OR shop_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
