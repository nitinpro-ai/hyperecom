import { Injectable, Logger } from "@nestjs/common";

/**
 * SMS sender port (M01 → M22 DLT provider later). Production impl sends via the
 * DLT-registered template; dev logs to console (mailpit-style). The port lets
 * the AuthService stay provider-agnostic and testable.
 */
export interface SmsPort {
  sendOtp(phone: string, otp: string): Promise<void>;
}

@Injectable()
export class ConsoleSmsPort implements SmsPort {
  private readonly log = new Logger("SMS");
  async sendOtp(phone: string, otp: string): Promise<void> {
    // DEV ONLY — never log OTPs in production; real impl calls the DLT provider.
    this.log.log(`[dev] OTP for ${phone}: ${otp}`);
  }
}
