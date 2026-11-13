import { describe, expect, it } from "vitest";
import { RefreshFamilyService, InMemoryRefreshStore } from "./refresh-family.service";

/** M01 acceptance: refresh rotation + reuse → family revoke (theft detection). */
describe("RefreshFamilyService", () => {
  const svc = () => new RefreshFamilyService(new InMemoryRefreshStore());

  it("starts a family and rotates to a new token each refresh", async () => {
    const s = svc();
    const { family, refreshToken: t0 } = await s.start("u1");

    const r1 = await s.rotate(family, t0);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.refreshToken).not.toBe(t0); // rotated

    const r2 = await s.rotate(family, r1.refreshToken);
    expect(r2.ok).toBe(true);
    if (r2.ok) expect(r2.refreshToken).not.toBe(r1.refreshToken);
  });

  it("reusing a consumed token revokes the WHOLE family (theft detection)", async () => {
    const s = svc();
    const { family, refreshToken: t0 } = await s.start("u1");
    const r1 = await s.rotate(family, t0); // t0 now consumed
    expect(r1.ok).toBe(true);

    // attacker replays the old (consumed) token
    const theft = await s.rotate(family, t0);
    expect(theft).toEqual({ ok: false, reason: "REUSE_DETECTED" });

    // the legitimate current token is now dead too — family revoked
    if (r1.ok) {
      const after = await s.rotate(family, r1.refreshToken);
      expect(after).toEqual({ ok: false, reason: "REVOKED" });
    }
    expect(await s.isRevoked(family)).toBe(true);
  });

  it("rejects an unknown family", async () => {
    const s = svc();
    expect(await s.rotate("no-such-family", "x")).toEqual({ ok: false, reason: "UNKNOWN" });
  });

  it("rejects a token that is neither current nor consumed", async () => {
    const s = svc();
    const { family } = await s.start("u1");
    expect(await s.rotate(family, "forged-token")).toEqual({ ok: false, reason: "REVOKED" });
  });

  it("explicit revokeFamily kills all further refreshes", async () => {
    const s = svc();
    const { family, refreshToken } = await s.start("u1");
    await s.revokeFamily(family);
    expect(await s.rotate(family, refreshToken)).toEqual({ ok: false, reason: "REVOKED" });
  });
});
