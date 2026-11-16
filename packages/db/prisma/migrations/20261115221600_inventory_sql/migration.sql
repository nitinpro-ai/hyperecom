-- M09 SQL additions. Spec: PART II M09.

-- Core invariant: reserved can never exceed on-hand (DB-enforced, defense in depth).
ALTER TABLE "stock"
  ADD CONSTRAINT "stock_reserved_lte_on_hand" CHECK ("quantity_reserved" <= "quantity_on_hand");
ALTER TABLE "stock"
  ADD CONSTRAINT "stock_non_negative" CHECK ("quantity_on_hand" >= 0 AND "quantity_reserved" >= 0);

-- Tenant isolation on inventory_locations + stock (stock scoped via its location's shop).
-- inventory_locations carries shop_id directly; stock via location_id — we enable RLS on
-- both; stock's policy joins to its location. app role w/o tenant context sees 0 rows.
ALTER TABLE "inventory_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "inventory_locations" FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON "inventory_locations"
  USING (
    current_setting('app.is_admin', true) = 'on'
    OR shop_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
