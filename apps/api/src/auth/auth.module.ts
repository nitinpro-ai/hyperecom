import { Module } from "@nestjs/common";
import { AuthService, OTP_STORE, SMS_PORT, AUTH_PEPPER, JWT_SECRET } from "./auth.service";
import { AuthController } from "./auth.controller";
import { RefreshFamilyService } from "./refresh-family.service";
import { JwtAuthGuard, RolesGuard } from "./auth.guard";
import { InMemoryOtpStore } from "./otp.store";
import { ConsoleSmsPort } from "./sms.port";

/**
 * M01 — Auth. OTP login + JWT sessions + refresh rotation/reuse detection.
 *
 * DEV wiring: in-memory OTP store + console SMS. Production swaps:
 *   OTP_STORE → Redis store, SMS_PORT → DLT provider (M22), and real secrets.
 * Users table owned by M02.
 */
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    RefreshFamilyService,
    JwtAuthGuard,
    RolesGuard,
    { provide: OTP_STORE, useClass: InMemoryOtpStore },
    { provide: SMS_PORT, useClass: ConsoleSmsPort },
    { provide: AUTH_PEPPER, useValue: process.env.AUTH_PEPPER ?? "dev-pepper" },
    { provide: JWT_SECRET, useValue: process.env.JWT_SECRET ?? "dev-secret" },
  ],
  exports: [AuthService, RefreshFamilyService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
