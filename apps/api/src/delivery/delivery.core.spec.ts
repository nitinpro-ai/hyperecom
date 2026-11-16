import { describe, expect, it } from "vitest";
import {
  isEligible, scoreCandidate, rankCandidates,
  generateDeliveryOtp, hashDeliveryOtp, verifyDeliveryOtp,
  feeForDistance, etaForDistance, type Candidate,
} from "./delivery.core";

const base = (over: Partial<Candidate> = {}): Candidate => ({
  deliveryPartnerId: "p", distanceKm: 1, activeJobs: 0, rating: 5,
  vehicleFit: 1, available: true, sameCity: true, ...over,
});

describe("delivery.core — eligibility", () => {
  it("accepts a valid candidate", () => expect(isEligible(base())).toBe(true));
  it("rejects unavailable / wrong city / >3km / >2 jobs / no vehicle fit", () => {
    expect(isEligible(base({ available: false }))).toBe(false);
    expect(isEligible(base({ sameCity: false }))).toBe(false);
    expect(isEligible(base({ distanceKm: 3.5 }))).toBe(false);
    expect(isEligible(base({ activeJobs: 3 }))).toBe(false);
    expect(isEligible(base({ vehicleFit: 0 }))).toBe(false);
  });
});

describe("delivery.core — scoring order", () => {
  it("closer rider scores higher (distance dominates at 0.4)", () => {
    expect(scoreCandidate(base({ distanceKm: 0.5 }))).toBeGreaterThan(scoreCandidate(base({ distanceKm: 2.5 })));
  });
  it("fewer active jobs scores higher, all else equal", () => {
    expect(scoreCandidate(base({ activeJobs: 0 }))).toBeGreaterThan(scoreCandidate(base({ activeJobs: 2 })));
  });
  it("rankCandidates returns eligible, best-first, drops ineligible", () => {
    const ranked = rankCandidates([
      base({ deliveryPartnerId: "far", distanceKm: 2.8, rating: 4 }),
      base({ deliveryPartnerId: "near", distanceKm: 0.4, rating: 4 }),
      base({ deliveryPartnerId: "offline", available: false }),
      base({ deliveryPartnerId: "busy", activeJobs: 3 }),
    ]);
    expect(ranked.map((r) => r.deliveryPartnerId)).toEqual(["near", "far"]); // 2 eligible, near first
  });
});

describe("delivery.core — OTP", () => {
  it("generates a 4-digit OTP", () => {
    for (let i = 0; i < 30; i++) expect(generateDeliveryOtp()).toMatch(/^\d{4}$/);
  });
  it("verifies correct OTP, rejects wrong", () => {
    const h = hashDeliveryOtp("1234", "salt");
    expect(verifyDeliveryOtp("1234", "salt", h)).toBe(true);
    expect(verifyDeliveryOtp("0000", "salt", h)).toBe(false);
  });
});

describe("delivery.core — fee + ETA", () => {
  it("fee scales with distance", () => {
    expect(feeForDistance(0)).toBe(2000);
    expect(feeForDistance(2000)).toBe(4000); // 20 + 10*2
  });
  it("ETA has a floor and scales", () => {
    expect(etaForDistance(0)).toBe(20);
    expect(etaForDistance(5000)).toBeGreaterThan(20);
  });
});
