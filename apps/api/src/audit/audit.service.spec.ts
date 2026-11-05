import { describe, beforeEach, expect, it, vi } from "vitest";
import { AuditService } from "./audit.service";

/** M26 acceptance: privileged action without audit fails; destructive needs reason. */
describe("AuditService", () => {
  const create = vi.fn().mockResolvedValue({});
  const tx = { auditLog: { create } } as never;

  beforeEach(() => create.mockClear());

  it("records inside the caller's transaction", async () => {
    await new AuditService().record(tx as never, {
      action: "KYC_APPROVE", entityType: "seller",
      entityId: "0e5d1b4a-0000-0000-0000-000000000002",
      actorUserId: "0e5d1b4a-0000-0000-0000-000000000003", actorRole: "CITY_ADMIN",
      after: { status: "APPROVED" },
    });
    expect(create).toHaveBeenCalledOnce();
  });

  it("REFUSES destructive action without reason (tx rolls back)", async () => {
    await expect(
      new AuditService().record(tx as never, {
        action: "SHOP_SUSPEND", entityType: "shop",
        entityId: "0e5d1b4a-0000-0000-0000-000000000004",
      })
    ).rejects.toThrow("requires a reason");
    expect(create).not.toHaveBeenCalled();
  });

  it("records destructive action WITH reason", async () => {
    await new AuditService().record(tx as never, {
      action: "SHOP_SUSPEND", entityType: "shop",
      entityId: "0e5d1b4a-0000-0000-0000-000000000004", reason: "fraud report #12",
    });
    expect(create).toHaveBeenCalledOnce();
  });
});
