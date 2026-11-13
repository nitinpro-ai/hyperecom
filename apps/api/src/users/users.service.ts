import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";

export interface AddressInput {
  label?: string;
  line1: string;
  line2?: string;
  landmark?: string;
  localityId?: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  isDefault?: boolean;
}

/**
 * M02 — Users, Profiles & RBAC. Profiles, addresses (geocoded on save), role
 * grants. Address save emits address.created.v1 in the same transaction (D-015).
 */
@Injectable()
export class UsersService {
  async me(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        locale: true,
        status: true,
        roles: { select: { role: { select: { name: true } }, cityId: true, shopId: true } },
      },
    });
  }

  async listAddresses(userId: string) {
    return prisma.address.findMany({ where: { userId }, orderBy: { isDefault: "desc" } });
  }

  /** Geocode-on-save: fill lat/lng from geocode_cache when not provided. */
  async addAddress(userId: string, input: AddressInput) {
    let { latitude, longitude } = input;
    if (latitude == null || longitude == null) {
      const cacheKey = `pincode:${input.pincode}`;
      const cached = await prisma.geocodeCache.findUnique({ where: { cacheKey } });
      if (cached?.lat != null && cached?.lng != null) {
        latitude = cached.lat;
        longitude = cached.lng;
      }
    }

    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      }
      const address = await tx.address.create({
        data: {
          userId,
          label: input.label ?? null,
          line1: input.line1,
          line2: input.line2 ?? null,
          landmark: input.landmark ?? null,
          localityId: input.localityId ?? null,
          pincode: input.pincode,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          isDefault: input.isDefault ?? false,
        },
      });
      await tx.outboxEvent.create({
        data: {
          aggregateType: "address",
          aggregateId: address.id,
          eventType: "address.created.v1",
          payload: { addressId: address.id, userId, pincode: input.pincode },
        },
      });
      return address;
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<boolean> {
    const result = await prisma.address.deleteMany({ where: { id: addressId, userId } });
    return result.count > 0;
  }
}

/**
 * PURE RBAC helper — can an actor (with role grants scoped to cities) act on a
 * resource in targetCityId? SUPER_ADMIN is global; CITY_ADMIN only within its
 * granted city. Fully unit-testable without a DB.
 */
export interface RoleGrant {
  role: string;
  cityId?: string | null;
}

export function canActInCity(grants: RoleGrant[], targetCityId: string): boolean {
  for (const g of grants) {
    if (g.role === "SUPER_ADMIN") return true;
    if (g.role === "CITY_ADMIN" && g.cityId === targetCityId) return true;
  }
  return false;
}
