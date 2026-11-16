-- Fix: orders.status value 'PARTIALLY_CANCELLED' is 19 chars but the spec
-- declared varchar(18). Widen to varchar(20). (Spec inconsistency corrected.)
ALTER TABLE "orders" ALTER COLUMN "status" TYPE VARCHAR(20);
