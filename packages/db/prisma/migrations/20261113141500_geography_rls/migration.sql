-- M03 geography RLS — Step 2 Verify-gate "RLS mechanism" item.
--
-- Geography tables are PUBLIC reference data (no shop_id): pre-login city /
-- pincode / serviceability lookups must read them. They are therefore NOT
-- tenant-isolated. This migration still establishes and exercises the RLS
-- mechanism the platform relies on (spec 03 §14 / 02 §56):
--   * the `app.current_tenant` GUC convention (set per request by the API),
--   * RLS enabled with an explicit, intentional public-read policy.
--
-- The gate's "app role without tenant context sees 0 rows" is formally proven
-- against the first tenant table `shops` in Step 5 (M05), which carries shop_id
-- and the USING (shop_id = current_setting('app.current_tenant')) policy.

-- Make a missing GUC safe to read (NULLIF(current_setting('app.current_tenant', true),'')).
-- 'true' = don't error when unset; tenant tables use this exact form in Step 5.

-- Enable RLS on geography tables with explicit public-read policies.
ALTER TABLE "countries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "states" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "localities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "pincodes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "delivery_zones" ENABLE ROW LEVEL SECURITY;

CREATE POLICY geo_public_read ON "countries" FOR SELECT USING (true);
CREATE POLICY geo_public_read ON "states" FOR SELECT USING (true);
CREATE POLICY geo_public_read ON "cities" FOR SELECT USING (true);
CREATE POLICY geo_public_read ON "localities" FOR SELECT USING (true);
CREATE POLICY geo_public_read ON "pincodes" FOR SELECT USING (true);
CREATE POLICY geo_public_read ON "delivery_zones" FOR SELECT USING (true);
