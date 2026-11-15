import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import {
  isValidPan,
  isValidGstin,
  nextStatus,
  type SellerStatus,
  type KycAction,
} from "./sellers.core";

export interface RegisterSellerInput {
  userId: string;
  legalName: string;
  displayName: string;
  businessType: string;
  pan: string;
  gstin?: string;
}

export type RegisterResult =
  | { ok: true; sellerId: string }
  | { ok: false; reason: "INVALID_PAN" | "INVALID_GSTIN" | "ALREADY_REGISTERED" };

export type KycResult =
  | { ok: true; status: SellerStatus }
  | { ok: false; reason: "NOT_FOUND" | "ILLEGAL_TRANSITION" };

/**
 * M04 — Sellers & KYC. Registration, KYC submission, admin approval machine.
 * State machine in sellers.core; events via outbox; approval cascade activates
 * the seller's shops (handled with M05 ShopsService on shop.created).
 */
@Injectable()
export class SellersService {
  async register(input: RegisterSellerInput): Promise<RegisterResult> {
    if (!isValidPan(input.pan)) return { ok: false, reason: "INVALID_PAN" };
    if (input.gstin && !isValidGstin(input.gstin)) return { ok: false, reason: "INVALID_GSTIN" };

    const existing = await prisma.seller.findUnique({ where: { userId: input.userId } });
    if (existing) return { ok: false, reason: "ALREADY_REGISTERED" };

    const seller = await prisma.seller.create({
      data: {
        userId: input.userId,
        legalName: input.legalName,
        displayName: input.displayName,
        businessType: input.businessType,
        pan: input.pan,
        gstin: input.gstin ?? null,
        status: "DRAFT",
      },
    });
    return { ok: true, sellerId: seller.id };
  }

  async submitKyc(sellerId: string): Promise<KycResult> {
    return this.transition(sellerId, "SUBMIT", (tx, seller) =>
      tx.outboxEvent.create({
        data: {
          aggregateType: "seller",
          aggregateId: seller.id,
          eventType: "kyc.submitted.v1",
          payload: { sellerId: seller.id },
        },
      }),
      { kycSubmittedAt: new Date() },
    );
  }

  /** Resolve the seller owned by a user, then submit KYC. */
  async submitKycForUser(userId: string): Promise<KycResult> {
    const seller = await prisma.seller.findUnique({ where: { userId } });
    if (!seller) return { ok: false, reason: "NOT_FOUND" };
    return this.submitKyc(seller.id);
  }

  /** Admin approve → emits kyc.approved.v1 (ShopsService activates shops on it). */
  async approve(sellerId: string, adminUserId: string): Promise<KycResult> {
    return this.transition(sellerId, "APPROVE", (tx, seller) =>
      tx.outboxEvent.create({
        data: {
          aggregateType: "seller",
          aggregateId: seller.id,
          eventType: "kyc.approved.v1",
          payload: { sellerId: seller.id },
        },
      }),
      { approvedAt: new Date(), approvedBy: adminUserId },
    );
  }

  async reject(sellerId: string): Promise<KycResult> {
    return this.transition(sellerId, "REJECT");
  }

  async suspend(sellerId: string): Promise<KycResult> {
    return this.transition(sellerId, "SUSPEND");
  }

  /** Generic guarded transition: validates via the state machine in one tx. */
  private async transition(
    sellerId: string,
    action: KycAction,
    sideEffect?: (tx: typeof prisma, seller: { id: string }) => Promise<unknown>,
    extraData: Record<string, unknown> = {},
  ): Promise<KycResult> {
    return prisma.$transaction(async (tx) => {
      const seller = await tx.seller.findUnique({ where: { id: sellerId } });
      if (!seller) return { ok: false, reason: "NOT_FOUND" as const };

      const to = nextStatus(seller.status as SellerStatus, action);
      if (!to) return { ok: false, reason: "ILLEGAL_TRANSITION" as const };

      await tx.seller.update({ where: { id: sellerId }, data: { status: to, ...extraData } });
      if (sideEffect) await sideEffect(tx as unknown as typeof prisma, seller);
      return { ok: true, status: to };
    });
  }
}
