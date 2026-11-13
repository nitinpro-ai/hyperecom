import { describe, expect, it } from "vitest";
import { JwtAuthGuard, RolesGuard } from "./auth.guard";
import { signAccess } from "./auth.crypto";

const SECRET = "guard-secret";

function ctxWith(headers: Record<string, string>, user?: unknown, handler?: unknown) {
  const req: any = { headers, user };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler ?? (() => undefined),
  } as any;
}

describe("JwtAuthGuard", () => {
  const guard = new JwtAuthGuard(SECRET);

  it("accepts a valid Bearer token and attaches claims", () => {
    const token = signAccess({ sub: "u1", roles: ["CUSTOMER"] }, SECRET, Date.now());
    const ctx = ctxWith({ authorization: `Bearer ${token}` });
    expect(guard.canActivate(ctx)).toBe(true);
    expect(ctx.switchToHttp().getRequest().user.sub).toBe("u1");
  });

  it("rejects a missing token (401)", () => {
    expect(() => guard.canActivate(ctxWith({}))).toThrow(/missing bearer/i);
  });

  it("rejects a tampered/invalid token (401 → revoked access)", () => {
    const token = signAccess({ sub: "u1", roles: [] }, "OTHER-SECRET", Date.now());
    expect(() => guard.canActivate(ctxWith({ authorization: `Bearer ${token}` }))).toThrow();
  });
});

describe("RolesGuard", () => {
  const guard = new RolesGuard();

  it("allows when no roles are required", () => {
    expect(guard.canActivate(ctxWith({}, { sub: "u", roles: [] }))).toBe(true);
  });

  it("allows when the user has a required role", () => {
    const handler = () => undefined;
    Reflect.defineMetadata("roles", ["CITY_ADMIN"], handler);
    expect(guard.canActivate(ctxWith({}, { sub: "u", roles: ["CITY_ADMIN"] }, handler))).toBe(true);
  });

  it("denies when the user lacks the required role (403 path)", () => {
    const handler = () => undefined;
    Reflect.defineMetadata("roles", ["SUPER_ADMIN"], handler);
    expect(guard.canActivate(ctxWith({}, { sub: "u", roles: ["CUSTOMER"] }, handler))).toBe(false);
  });
});
