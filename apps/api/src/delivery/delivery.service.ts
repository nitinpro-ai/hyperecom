import { Injectable } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { prisma } from "@apnacity/db";
import {
  rankCandidates, generateDeliveryOtp, hashDeliveryOtp, verifyDeliveryOtp,
  feeForDistance, etaForDistance, OTP_MAX_ATTEMPTS, type Candidate,
} from "./delivery.core";

const OFFER_WINDOW_MS = 60_000; // 60-s offer (spec)
const MAX_FAILED = 2; // retry ×2 → reverse job

export interface CreateJobInput {
  sellerOrderId: string;
  mode?: "PLATFORM_RIDER" | "SELLER_SELF";
  pickup: { lat: number; lng: number };
  drop: { lat: number; lng: number };
  distanceM: number;
}

@Injectable()
export class DeliveryService {
  /** Create a FORWARD delivery job (called when a child order is READY). */
  async createJob(input: CreateJobInput): Promise<{ jobId: string }> {
    const job = await prisma.deliveryJob.create({
      data: {
        sellerOrderId: input.sellerOrderId, type: "FORWARD",
        mode: input.mode ?? "PLATFORM_RIDER", status: "UNASSIGNED",
        distanceM: input.distanceM, feePaise: BigInt(feeForDistance(input.distanceM)),
        etaMinutes: etaForDistance(input.distanceM),
      },
    });
    await prisma.$executeRaw`
      UPDATE delivery_jobs SET pickup_location = ST_SetSRID(ST_MakePoint(${input.pickup.lng}, ${input.pickup.lat}),4326),
        drop_location = ST_SetSRID(ST_MakePoint(${input.drop.lng}, ${input.drop.lat}),4326)
      WHERE id = ${job.id}::uuid`;
    return { jobId: job.id };
  }

  /**
   * Assign the best-scoring eligible rider a 60-s offer. Returns the offered
   * rider, or null if no candidate. assignment_reason stored (auditable).
   */
  async assign(jobId: string, candidates: Candidate[]): Promise<{ offeredTo: string } | null> {
    const ranked = rankCandidates(candidates);
    if (ranked.length === 0) return null;
    const best = ranked[0]!;
    await prisma.$transaction(async (tx) => {
      await tx.deliveryJob.update({
        where: { id: jobId },
        data: {
          status: "ASSIGNED", deliveryPartnerId: best.deliveryPartnerId,
          assignedAt: new Date(), expiresAt: new Date(Date.now() + OFFER_WINDOW_MS),
          assignmentReason: { ranked: ranked.map((r) => ({ id: r.deliveryPartnerId, score: Number(r.score.toFixed(4)) })) },
        },
      });
      await tx.trackingEvent.create({ data: { deliveryJobId: jobId, deliveryPartnerId: best.deliveryPartnerId, event: "ASSIGNED" } });
    });
    return { offeredTo: best.deliveryPartnerId };
  }

  /** Rider accepts an offer (must be within the 60-s window). */
  async accept(jobId: string, partnerId: string): Promise<{ ok: boolean; reason?: string }> {
    const job = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
    if (!job || job.deliveryPartnerId !== partnerId || job.status !== "ASSIGNED") return { ok: false, reason: "NOT_ASSIGNED_TO_YOU" };
    if (job.expiresAt && job.expiresAt.getTime() < Date.now()) return { ok: false, reason: "OFFER_EXPIRED" };
    await prisma.$transaction(async (tx) => {
      await tx.deliveryJob.update({ where: { id: jobId }, data: { status: "ACCEPTED" } });
      await tx.trackingEvent.create({ data: { deliveryJobId: jobId, deliveryPartnerId: partnerId, event: "ACCEPTED" } });
    });
    return { ok: true };
  }

  /** Rider rejects (or offer expired) → re-offer to the next candidate. */
  async rejectAndReoffer(jobId: string, remaining: Candidate[]): Promise<{ offeredTo: string } | null> {
    await prisma.$transaction(async (tx) => {
      const job = await tx.deliveryJob.findUnique({ where: { id: jobId } });
      await tx.trackingEvent.create({ data: { deliveryJobId: jobId, deliveryPartnerId: job?.deliveryPartnerId, event: "REJECTED" } });
      await tx.deliveryJob.update({ where: { id: jobId }, data: { status: "UNASSIGNED", deliveryPartnerId: null, expiresAt: null } });
    });
    return this.assign(jobId, remaining);
  }

  /** Dispatch the OTP (called at DISPATCHED): generate, hash-store, return plaintext to send via SMS/app. */
  async issueOtp(jobId: string): Promise<string> {
    const otp = generateDeliveryOtp();
    const salt = randomBytes(8).toString("hex");
    await prisma.deliveryJob.update({ where: { id: jobId }, data: { otpHash: `${salt}$${hashDeliveryOtp(otp, salt)}`, otpAttempts: 0 } });
    return otp;
  }

  /** Status progression: picked_up / in_transit / at_drop. */
  async status(jobId: string, to: "AT_PICKUP" | "PICKED_UP" | "IN_TRANSIT" | "AT_DROP", partnerId: string): Promise<{ ok: boolean }> {
    await prisma.$transaction(async (tx) => {
      await tx.deliveryJob.update({ where: { id: jobId }, data: { status: to, ...(to === "PICKED_UP" ? { pickedUpAt: new Date() } : {}) } });
      await tx.trackingEvent.create({ data: { deliveryJobId: jobId, deliveryPartnerId: partnerId, event: to === "IN_TRANSIT" ? "IN_TRANSIT_PING" : to } });
    });
    return { ok: true };
  }

  /** OTP verify at the door → DELIVERED. 3 wrong → lock (support ticket). */
  async verifyOtp(jobId: string, otp: string): Promise<{ ok: boolean; reason?: "WRONG_OTP" | "LOCKED" | "NO_OTP"; attemptsLeft?: number }> {
    const job = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
    if (!job?.otpHash) return { ok: false, reason: "NO_OTP" };
    if (job.otpAttempts >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "LOCKED" };
    const [salt, hash] = job.otpHash.split("$");
    if (!verifyDeliveryOtp(otp, salt!, hash!)) {
      const attempts = job.otpAttempts + 1;
      await prisma.deliveryJob.update({ where: { id: jobId }, data: { otpAttempts: attempts } });
      return { ok: false, reason: attempts >= OTP_MAX_ATTEMPTS ? "LOCKED" : "WRONG_OTP", attemptsLeft: Math.max(0, OTP_MAX_ATTEMPTS - attempts) };
    }
    await prisma.$transaction(async (tx) => {
      await tx.deliveryJob.update({ where: { id: jobId }, data: { status: "DELIVERED", deliveredAt: new Date() } });
      await tx.trackingEvent.create({ data: { deliveryJobId: jobId, deliveryPartnerId: job.deliveryPartnerId, event: "OTP_VERIFIED" } });
      await tx.trackingEvent.create({ data: { deliveryJobId: jobId, deliveryPartnerId: job.deliveryPartnerId, event: "DELIVERED" } });
      await tx.proofOfDelivery.create({ data: { deliveryJobId: jobId, otpVerified: true } });
      await tx.outboxEvent.create({ data: { aggregateType: "delivery_job", aggregateId: jobId, eventType: "delivery.delivered.v1", payload: { jobId, sellerOrderId: job.sellerOrderId } } });
    });
    return { ok: true };
  }

  /** Failed attempt. reason required; retry ×2 → RETURNED_TO_SELLER reverse job. */
  async fail(jobId: string, reason: string): Promise<{ ok: boolean; reverseJobId?: string; status: string }> {
    const job = await prisma.deliveryJob.findUnique({ where: { id: jobId } });
    if (!job) return { ok: false, status: "NOT_FOUND" };
    const failedCount = job.failedCount + 1;
    if (failedCount > MAX_FAILED) {
      const reverse = await prisma.$transaction(async (tx) => {
        await tx.deliveryJob.update({ where: { id: jobId }, data: { status: "RETURNED_TO_SELLER", failedCount, failedReason: reason } });
        await tx.trackingEvent.create({ data: { deliveryJobId: jobId, deliveryPartnerId: job.deliveryPartnerId, event: "FAILED" } });
        const rev = await tx.deliveryJob.create({
          data: { sellerOrderId: job.sellerOrderId, type: "RETURN_PICKUP", mode: job.mode, status: "UNASSIGNED", distanceM: job.distanceM, feePaise: job.feePaise, etaMinutes: job.etaMinutes },
        });
        // copy geometry (reverse: swap pickup/drop)
        await tx.$executeRaw`UPDATE delivery_jobs SET pickup_location=(SELECT drop_location FROM delivery_jobs WHERE id=${jobId}::uuid), drop_location=(SELECT pickup_location FROM delivery_jobs WHERE id=${jobId}::uuid) WHERE id=${rev.id}::uuid`;
        await tx.outboxEvent.create({ data: { aggregateType: "delivery_job", aggregateId: jobId, eventType: "delivery.failed.v1", payload: { jobId, reverseJobId: rev.id } } });
        return rev.id;
      });
      return { ok: true, reverseJobId: reverse, status: "RETURNED_TO_SELLER" };
    }
    await prisma.$transaction(async (tx) => {
      await tx.deliveryJob.update({ where: { id: jobId }, data: { status: "FAILED", failedCount, failedReason: reason } });
      await tx.trackingEvent.create({ data: { deliveryJobId: jobId, deliveryPartnerId: job.deliveryPartnerId, event: "FAILED" } });
    });
    return { ok: true, status: "FAILED" };
  }

  /** Customer live tracking. */
  async tracking(jobId: string) {
    const events = await prisma.trackingEvent.findMany({ where: { deliveryJobId: jobId }, orderBy: { createdAt: "asc" }, select: { event: true, createdAt: true } });
    const job = await prisma.deliveryJob.findUnique({ where: { id: jobId }, select: { status: true, etaMinutes: true } });
    return { status: job?.status, etaMinutes: job?.etaMinutes, events };
  }
}
