-- M05 tenant isolation — the Step-4/5 "tenancy" deliverable (spec 03 §14).
-- shops is the tenant root; shop-scoped tables carry shop_id and isolate via the
-- app.current_tenant GUC set per request. This proves the mechanism the gate
-- checks: "app role WITHOUT a tenant context sees 0 rows".
--
-- Enforcement model:
--   * RLS enabled + FORCED (owner is also subject to policy).
--   * tenant_isolation: a row is visible only when its shop_id matches the GUC,
--     OR the admin bypass GUC app.is_admin='on' is set (SUPER_ADMIN service role).
--   * With neither GUC set, NULLIF(...,'')::uuid = shop_id is NULL → no rows.

ALTER TABLE "shops" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shops" FORCE ROW LEVEL SECURITY;
ALTER TABLE "shop_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shop_settings" FORCE ROW LEVEL SECURITY;
ALTER TABLE "shop_domains" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "shop_domains" FORCE ROW LEVEL SECURITY;

-- shops: id IS the tenant (shop_id == shops.id)
CREATE POLICY tenant_isolation ON "shops"
  USING (
    current_setting('app.is_admin', true) = 'on'
    OR id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON "shop_settings"
  USING (
    current_setting('app.is_admin', true) = 'on'
    OR shop_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );

CREATE POLICY tenant_isolation ON "shop_domains"
  USING (
    current_setting('app.is_admin', true) = 'on'
    OR shop_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
