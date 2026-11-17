-- M16 ledger integrity (spec): double-entry balance + append-only.

-- 1) Append-only: block UPDATE/DELETE on ledger_entries (immutable audit trail).
CREATE OR REPLACE FUNCTION apnacity_block_ledger_mutations() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only (M16): % is blocked', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ledger_entries_append_only
BEFORE UPDATE OR DELETE ON ledger_entries
FOR EACH ROW EXECUTE FUNCTION apnacity_block_ledger_mutations();

-- 2) Balanced transaction: at COMMIT, every transaction_id must have
--    SUM(debit) = SUM(credit). Deferred constraint trigger so multi-row
--    postings within one transaction are checked once, at the end.
CREATE OR REPLACE FUNCTION apnacity_check_ledger_balanced() RETURNS trigger AS $$
DECLARE
  d bigint; c bigint;
BEGIN
  SELECT COALESCE(SUM(debit_paise),0), COALESCE(SUM(credit_paise),0)
    INTO d, c FROM ledger_entries WHERE transaction_id = NEW.transaction_id;
  IF d <> c THEN
    RAISE EXCEPTION 'ledger transaction % unbalanced: debit=% credit=%', NEW.transaction_id, d, c;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER ledger_entries_balanced
AFTER INSERT ON ledger_entries
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION apnacity_check_ledger_balanced();
