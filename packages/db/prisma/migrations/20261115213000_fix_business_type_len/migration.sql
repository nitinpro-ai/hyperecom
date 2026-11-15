-- Fix: business_type values include 'PROPRIETORSHIP' (14 chars) and
-- 'PARTNERSHIP' (11), but the spec declared VARCHAR(13) — PROPRIETORSHIP does
-- not fit. Widen to VARCHAR(20). (Spec inconsistency corrected.)
ALTER TABLE "sellers" ALTER COLUMN "business_type" TYPE VARCHAR(20);
