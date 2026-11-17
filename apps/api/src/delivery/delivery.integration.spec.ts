import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { uniquePhone } from "../test-utils";
import { prisma } from "@apnacity/db";
import { DeliveryService } from "./delivery.service";
import { RidersService } from "./riders.service";
import type { Candidate } from "./delivery.core";

/**
 * Step 13 gate (integration, live DB): scoring order, 60-s offer → reject →
 * next rider, OTP delivery path, failed ×2 → reverse job, offline sweep.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-m17";

d("M17/M18 delivery (integration)", () => {
  const delivery = new DeliveryService();
  const riders = new RidersService();
  let sellerOrderId = "", jobId = "";
  let NEAR = "", FAR = "";

  const cand = (id: string, over: Partial<Candidate> = {}): Candidate => ({
    deliveryPartnerId: id, distanceKm: 1, activeJobs: 0, rating: 5, vehicleFit: 1, available: true, sameCity: true, ...over,
  });

  beforeAll(async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "bijnor" } });
    // a minimal seller_order to hang a job on
    const u = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    const seller = await prisma.seller.create({ data: { userId: u.id, legalName: TAG, displayName: TAG, businessType: "INDIVIDUAL", pan: "ABCDE1234F", status: "APPROVED" } });
    const shop = await prisma.shop.create({ data: { sellerId: seller.id, cityId: city.id, name: `${TAG}s`, slug: `${TAG}s-${Date.now()}`, status: "ACTIVE" } });
    const order = await prisma.order.create({ data: { orderNo: `APN-T-${Date.now()}`, userId: u.id, cityId: city.id, addressSnapshot: {}, itemsTotalPaise: 70000n, deliveryTotalPaise: 4000n, taxTotalPaise: 0n, grandTotalPaise: 74000n, status: "PLACED" } });
    const so = await prisma.sellerOrder.create({ data: { orderId: order.id, shopId: shop.id, sellerOrderNo: `${order.orderNo}-1`, itemsTotalPaise: 70000n, deliveryFeePaise: 4000n, taxTotalPaise: 0n, status: "READY" } });
    sellerOrderId = so.id;

    // two real delivery partners (FK target for assignment)
    const un = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    const uf = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    NEAR = (await riders.register(un.id, city.id, "BIKE")).id;
    FAR = (await riders.register(uf.id, city.id, "BIKE")).id;
  });

  afterAll(async () => {
    const jobs = await prisma.deliveryJob.findMany({ where: { sellerOrderId }, select: { id: true } });
    const jids = jobs.map((j) => j.id);
    await prisma.trackingEvent.deleteMany({ where: { deliveryJobId: { in: jids } } });
    await prisma.proofOfDelivery.deleteMany({ where: { deliveryJobId: { in: jids } } });
    await prisma.deliveryJob.deleteMany({ where: { sellerOrderId } });
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { in: jids } } });
    const users = await prisma.user.findMany({ where: { name: TAG }, select: { id: true } });
    const uids = users.map((u) => u.id);
    await prisma.deliveryPartner.deleteMany({ where: { userId: { in: uids } } });
    const sos = await prisma.sellerOrder.findMany({ where: { orderId: { in: (await prisma.order.findMany({ where: { userId: { in: uids } }, select: { id: true } })).map((o) => o.id) } }, select: { id: true } });
    await prisma.sellerOrder.deleteMany({ where: { id: { in: sos.map((s) => s.id) } } });
    await prisma.order.deleteMany({ where: { userId: { in: uids } } });
    const shops = await prisma.shop.findMany({ where: { name: { startsWith: `${TAG}s` } }, select: { id: true } });
    await prisma.shop.deleteMany({ where: { id: { in: shops.map((s) => s.id) } } });
    await prisma.seller.deleteMany({ where: { userId: { in: uids } } });
    await prisma.user.deleteMany({ where: { id: { in: uids } } });
    await prisma.$disconnect();
  });

  it("creates a job + assigns the best-scoring rider (60-s offer), reject → next rider", async () => {
    const { jobId: jid } = await delivery.createJob({
      sellerOrderId, pickup: { lat: 29.37, lng: 78.13 }, drop: { lat: 29.38, lng: 78.15 }, distanceM: 2500,
    });
    jobId = jid;

    const candidates = [cand(NEAR, { distanceKm: 0.4 }), cand(FAR, { distanceKm: 2.5 })];
    const offer = await delivery.assign(jobId, candidates);
    expect(offer?.offeredTo).toBe(NEAR); // best score = closest

    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe("ASSIGNED");
    expect(job.expiresAt).not.toBeNull(); // 60-s window set
    expect(job.assignmentReason).not.toBeNull(); // auditable

    // near rider rejects → re-offer to far
    const reoffer = await delivery.rejectAndReoffer(jobId, [cand(FAR, { distanceKm: 2.5 })]);
    expect(reoffer?.offeredTo).toBe(FAR);
  });

  it("accept → status flow → OTP verify → DELIVERED + PoD + event", async () => {
    await delivery.accept(jobId, FAR);
    await delivery.status(jobId, "PICKED_UP", FAR);
    await delivery.status(jobId, "AT_DROP", FAR);
    const otp = await delivery.issueOtp(jobId);
    expect(otp).toMatch(/^\d{4}$/);

    const wrong = await delivery.verifyOtp(jobId, "0000" === otp ? "1111" : "0000");
    expect(wrong.ok).toBe(false);

    const ok = await delivery.verifyOtp(jobId, otp);
    expect(ok.ok).toBe(true);
    const job = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe("DELIVERED");
    expect(await prisma.proofOfDelivery.count({ where: { deliveryJobId: jobId } })).toBe(1);
    expect(await prisma.outboxEvent.findFirst({ where: { aggregateId: jobId, eventType: "delivery.delivered.v1" } })).not.toBeNull();
  });

  it("failed ×3 (retry ×2 then one more) → RETURNED_TO_SELLER reverse job", async () => {
    const { jobId: jid } = await delivery.createJob({ sellerOrderId, pickup: { lat: 29.37, lng: 78.13 }, drop: { lat: 29.38, lng: 78.15 }, distanceM: 2000 });
    expect((await delivery.fail(jid, "customer not home")).status).toBe("FAILED"); // 1
    expect((await delivery.fail(jid, "customer not home")).status).toBe("FAILED"); // 2
    const third = await delivery.fail(jid, "unreachable"); // 3 > MAX_FAILED(2)
    expect(third.status).toBe("RETURNED_TO_SELLER");
    expect(third.reverseJobId).toBeDefined();
    const rev = await prisma.deliveryJob.findUniqueOrThrow({ where: { id: third.reverseJobId! } });
    expect(rev.type).toBe("RETURN_PICKUP");
  });

  it("offline sweep marks stale riders unavailable", async () => {
    const city = await prisma.city.findUniqueOrThrow({ where: { slug: "bijnor" } });
    const u = await prisma.user.create({ data: { phone: uniquePhone(), name: TAG } });
    const { id } = await riders.register(u.id, city.id, "BIKE");
    await riders.setAvailability(id, true);
    await prisma.deliveryPartner.update({ where: { id }, data: { lastSeenAt: new Date(Date.now() - 10 * 60 * 1000) } }); // 10 min ago
    const swept = await riders.sweepOffline();
    expect(swept).toBeGreaterThanOrEqual(1);
    const p = await prisma.deliveryPartner.findUniqueOrThrow({ where: { id } });
    expect(p.isAvailable).toBe(false);
  });
});
