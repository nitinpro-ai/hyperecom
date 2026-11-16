-- M12: exactly one OPEN cart per user (spec partial unique index).
CREATE UNIQUE INDEX one_open_cart ON carts (user_id) WHERE status = 'OPEN';

-- M14: tenant isolation on seller_orders (shop-scoped).
ALTER TABLE "seller_orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "seller_orders" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "seller_orders"
  USING (
    current_setting('app.is_admin', true) = 'on'
    OR shop_id = NULLIF(current_setting('app.current_tenant', true), '')::uuid
  );
