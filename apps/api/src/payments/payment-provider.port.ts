import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Payment provider abstraction (M15). The place-order flow and webhook handler
 * depend only on this port, so Cashfree/Razorpay swap in without touching order
 * logic. MockPaymentProvider lets the full purchase + webhook flow run and be
 * tested before real Cashfree sandbox keys exist (Tracking §7).
 */
export interface PaymentIntent {
  providerOrderRef: string;
  // in a real provider: a redirect/UPI-intent URL the client opens
  checkoutUrl: string;
}

export interface PaymentProviderPort {
  readonly name: "CASHFREE" | "RAZORPAY" | "MOCK";
  createIntent(orderId: string, amountPaise: number): Promise<PaymentIntent>;
  /** Verify a webhook payload's signature + return parsed capture info. */
  verifyWebhook(rawBody: string, signature: string): { valid: boolean; externalRef?: string; status?: string; amountPaise?: number };
}

import { orDevDefault } from "../auth/auth.guard";

const MOCK_SECRET = orDevDefault(process.env.PAYMENT_WEBHOOK_SECRET, "dev-webhook-secret", "PAYMENT_WEBHOOK_SECRET");

@Injectable()
export class MockPaymentProvider implements PaymentProviderPort {
  readonly name = "MOCK" as const;

  async createIntent(orderId: string, amountPaise: number): Promise<PaymentIntent> {
    const ref = `mock_${orderId.slice(0, 8)}_${Date.now().toString(36)}`;
    return { providerOrderRef: ref, checkoutUrl: `/mock-pay?ref=${ref}&amount=${amountPaise}` };
  }

  /** Sign a payload the way the provider would — used by tests to forge a valid webhook. */
  static sign(rawBody: string): string {
    return createHmac("sha256", MOCK_SECRET).update(rawBody).digest("hex");
  }

  verifyWebhook(rawBody: string, signature: string) {
    const expected = createHmac("sha256", MOCK_SECRET).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature ?? "");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { valid: false };
    try {
      const p = JSON.parse(rawBody) as { externalRef: string; status: string; amountPaise: number };
      return { valid: true, externalRef: p.externalRef, status: p.status, amountPaise: p.amountPaise };
    } catch {
      return { valid: false };
    }
  }
}
