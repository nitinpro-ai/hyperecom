/**
 * Test helpers for integration specs that run against the SHARED cluster DB.
 * Identifiers must be globally unique per process + call — Date.now() alone
 * collides when two creates land in the same millisecond or two suites overlap.
 */
import { randomInt } from "node:crypto";

let counter = 0;

/** Unique Indian phone: +91 + 10 digits, fits VarChar(15). */
export function uniquePhone(): string {
  counter = (counter + 1) % 1000;
  const rand = randomInt(0, 1_000_000); // 6 digits
  const seq = String(counter).padStart(3, "0");
  const tail = String(randomInt(0, 10)); // 1 digit → 6+3+1 = 10 digits
  return `+91${String(rand).padStart(6, "0")}${seq}${tail}`;
}

/** Unique 13-digit GTIN (starts 89, India prefix). */
export function uniqueGtin(): string {
  return `89${String(randomInt(0, 100_000_000_000)).padStart(11, "0")}`;
}
