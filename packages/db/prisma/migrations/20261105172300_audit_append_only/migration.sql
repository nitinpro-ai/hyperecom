-- M26: audit_logs is append-only at the DATABASE level (defense in depth).
CREATE OR REPLACE FUNCTION apnacity_block_audit_mutations() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (M26): % is blocked', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_logs_append_only
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION apnacity_block_audit_mutations();
