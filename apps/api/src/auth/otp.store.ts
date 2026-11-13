import { Injectable } from "@nestjs/common";
import type { OtpRecord } from "./auth.crypto";

/**
 * OTP record store. Keyed by phone. Backed by Redis (`otp:{phone}`) in
 * production; this in-memory impl is the testable/dev default and the seam the
 * AuthService depends on. Also tracks resend throttling.
 */
export interface OtpStore {
  get(phone: string): Promise<OtpRecord | undefined>;
  put(phone: string, rec: OtpRecord): Promise<void>;
  del(phone: string): Promise<void>;
}

@Injectable()
export class InMemoryOtpStore implements OtpStore {
  private m = new Map<string, OtpRecord>();
  async get(phone: string) {
    return this.m.get(phone);
  }
  async put(phone: string, rec: OtpRecord) {
    this.m.set(phone, rec);
  }
  async del(phone: string) {
    this.m.delete(phone);
  }
}
