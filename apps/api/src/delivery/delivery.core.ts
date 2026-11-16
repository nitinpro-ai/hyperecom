import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

/**
 * M17 delivery — pure cores: rider-assignment scoring + OTP. No DB. Spec PART II M17.
 */

export interface Candidate {
  deliveryPartnerId: string;
  distanceKm: number;    // from pickup
  activeJobs: number;    // current in-flight jobs (≤2 to be eligible)
  rating: number;        // 0–5
  vehicleFit: number;    // 0–1 (does vehicle suit the weight/distance)
  available: boolean;
  sameCity: boolean;
}

export interface ScoredCandidate extends Candidate {
  score: number;
}

const ELIGIBLE_MAX_DISTANCE_KM = 3;
const ELIGIBLE_MAX_ACTIVE_JOBS = 2;

/** Eligibility: available, same city, ≤3 km, ≤2 active jobs, vehicle fits. */
export function isEligible(c: Candidate): boolean {
  return c.available && c.sameCity && c.distanceKm <= ELIGIBLE_MAX_DISTANCE_KM
    && c.activeJobs <= ELIGIBLE_MAX_ACTIVE_JOBS && c.vehicleFit > 0;
}

/**
 * Score = 0.4×(1/distance_km) + 0.3×(1/(1+active_jobs)) + 0.2×rating + 0.1×vehicle_fit.
 * Higher is better. (distance_km floored at 0.1 to avoid div-by-zero.)
 */
export function scoreCandidate(c: Candidate): number {
  const dist = Math.max(c.distanceKm, 0.1);
  return (
    0.4 * (1 / dist) +
    0.3 * (1 / (1 + c.activeJobs)) +
    0.2 * c.rating +
    0.1 * c.vehicleFit
  );
}

/** Rank eligible candidates best-first (the offer order). */
export function rankCandidates(candidates: Candidate[]): ScoredCandidate[] {
  return candidates
    .filter(isEligible)
    .map((c) => ({ ...c, score: scoreCandidate(c) }))
    .sort((a, b) => b.score - a.score);
}

// ---- OTP (4-digit delivery OTP) -------------------------------------------

export const OTP_MAX_ATTEMPTS = 3; // 3 wrong → support ticket + call prompt
const OTP_PEPPER = process.env.DELIVERY_OTP_PEPPER ?? "dev-delivery-pepper";

export function generateDeliveryOtp(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

export function hashDeliveryOtp(otp: string, salt: string): string {
  return createHmac("sha256", OTP_PEPPER).update(`${otp}:${salt}`).digest("hex");
}

export function verifyDeliveryOtp(otp: string, salt: string, hash: string): boolean {
  const a = Buffer.from(hashDeliveryOtp(otp, salt), "hex");
  const b = Buffer.from(hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- delivery fee / ETA (simple distance model until M03 zones wire in) ----

export function feeForDistance(distanceM: number): number {
  const km = distanceM / 1000;
  const base = 2000; // ₹20 base
  const perKm = 1000; // ₹10/km
  return Math.round(base + perKm * km);
}

export function etaForDistance(distanceM: number): number {
  const km = distanceM / 1000;
  return Math.max(20, Math.round(15 + km * 8)); // ~8 min/km + 15 min handling, min 20
}
