import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";

const OFFLINE_MS = 5 * 60 * 1000; // offline > 5 min → auto-unavailable

@Injectable()
export class RidersService {
  async register(userId: string, cityId: string, vehicle: string) {
    const existing = await prisma.deliveryPartner.findUnique({ where: { userId } });
    if (existing) return { id: existing.id };
    const p = await prisma.deliveryPartner.create({ data: { userId, cityId, vehicle, kycStatus: "PENDING" } });
    return { id: p.id };
  }

  async setAvailability(partnerId: string, available: boolean) {
    await prisma.deliveryPartner.update({ where: { id: partnerId }, data: { isAvailable: available, lastSeenAt: new Date() } });
  }

  /** Batch location ping (throttled client-side ~15 s). Updates last_location + last_seen. */
  async ping(partnerId: string, lat: number, lng: number) {
    await prisma.$executeRaw`
      UPDATE delivery_partners SET last_location = ST_SetSRID(ST_MakePoint(${lng},${lat}),4326), last_seen_at = now()
      WHERE id = ${partnerId}::uuid`;
  }

  /** Sweep: riders not seen in >5 min → auto-unavailable. */
  async sweepOffline(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - OFFLINE_MS);
    const r = await prisma.deliveryPartner.updateMany({
      where: { isAvailable: true, lastSeenAt: { lt: cutoff } },
      data: { isAvailable: false },
    });
    return r.count;
  }

  /** Weekly earnings = sum of delivered job fees for this rider. */
  async earnings(partnerId: string, since: Date) {
    const jobs = await prisma.deliveryJob.findMany({
      where: { deliveryPartnerId: partnerId, status: "DELIVERED", deliveredAt: { gte: since } },
      select: { feePaise: true },
    });
    const totalPaise = jobs.reduce((s, j) => s + Number(j.feePaise ?? 0), 0);
    return { deliveries: jobs.length, totalPaise };
  }
}
