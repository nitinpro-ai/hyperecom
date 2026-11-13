import { describe, expect, it } from "vitest";
import { canActInCity, type RoleGrant } from "./users.service";

/** M02 acceptance: CITY_ADMIN cross-city denial; SUPER_ADMIN global. */
describe("canActInCity (RBAC)", () => {
  const BIJNOR = "city-bijnor";
  const DELHI = "city-delhi";

  it("SUPER_ADMIN can act in any city", () => {
    const grants: RoleGrant[] = [{ role: "SUPER_ADMIN" }];
    expect(canActInCity(grants, BIJNOR)).toBe(true);
    expect(canActInCity(grants, DELHI)).toBe(true);
  });

  it("CITY_ADMIN can act only within its granted city", () => {
    const grants: RoleGrant[] = [{ role: "CITY_ADMIN", cityId: BIJNOR }];
    expect(canActInCity(grants, BIJNOR)).toBe(true);
    expect(canActInCity(grants, DELHI)).toBe(false); // cross-city denial
  });

  it("CUSTOMER cannot act administratively in any city", () => {
    const grants: RoleGrant[] = [{ role: "CUSTOMER" }];
    expect(canActInCity(grants, BIJNOR)).toBe(false);
  });

  it("a user holding multiple roles (customer + city_admin) is allowed in its city", () => {
    const grants: RoleGrant[] = [
      { role: "CUSTOMER" },
      { role: "CITY_ADMIN", cityId: BIJNOR },
    ];
    expect(canActInCity(grants, BIJNOR)).toBe(true);
    expect(canActInCity(grants, DELHI)).toBe(false);
  });
});
