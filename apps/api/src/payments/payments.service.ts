import { Injectable, Inject } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { MockPaymentProvider, type PaymentProviderPort } from "./payment-provider.port";

export const PAYMENT_PROVIDER = Symbol("PAYMENT_PROVIDER");

export type WebhookResult =
  | { ok: true; outcome: "CAPTURED" | "IGNORED_REPLAY" }
  | { ok: false; reason: "BAD_SIGNATURE" | "UNKNOWN_PAYMENT" };

/**
 * M15 — Payments. The webhook is the ONLY capture authority (manual edits
 * forbidden). Signature verified; replay guarded via webhook_events unique
 * constraint; capture emits payment.captured.v1.
 */
@Injectable()
export class PaymentsService {
  constructor(@Inject(PAYMENT_PROVIDER) private readonly provider: PaymentProviderPort) {}

  async handleWebhook(rawBody: string, signature: string): Promise<WebhookResult> {
    const v = this.provider.verifyWebhook(rawBody, signature);
    if (!v.valid || !v.externalRef) return { ok: false, reason: "BAD_SIGNATURE" };

    // replay guard: unique (provider, eventType, externalRef)
    try {
      await prisma.webhookEvent.create({
        data: {
          provider: this.provider.name, eventType: v.status ?? "capture",
          externalRef: v.externalRef, signatureValid: true,
          rawPayload: JSON.parse(rawBody), processedAt: new Date(),
        },
      });
    } catch {
      return { ok: true, outcome: "IGNORED_REPLAY" }; // duplicate → already processed
    }

    const payment = await prisma.payment.findFirst({ where: { providerOrderRef: v.externalRef } });
    if (!payment) return { ok: false, reason: "UNKNOWN_PAYMENT" };

    if (v.status === "CAPTURED" && payment.status !== "CAPTURED") {
      await prisma.$transaction(async (tx) => {
        await tx.payment.update({ where: { id: payment.id }, data: { status: "CAPTURED", capturedAt: new Date() } });
        await tx.paymentTransaction.create({
          data: { paymentId: payment.id, type: "CAPTURE", status: "CAPTURED", amountPaise: payment.amountPaise, signatureVerified: true, rawPayload: JSON.parse(rawBody) },
        });
        await tx.outboxEvent.create({
          data: { aggregateType: "payment", aggregateId: payment.id, eventType: "payment.captured.v1", payload: { paymentId: payment.id, orderId: payment.orderId } },
        });
      });
    }
    return { ok: true, outcome: "CAPTURED" };
  }

  /** Attach a provider order ref to a payment (after createIntent). */
  async createIntent(paymentId: string, orderId: string, amountPaise: number) {
    const intent = await this.provider.createIntent(orderId, amountPaise);
    await prisma.payment.update({ where: { id: paymentId }, data: { providerOrderRef: intent.providerOrderRef } });
    return intent;
  }
}
