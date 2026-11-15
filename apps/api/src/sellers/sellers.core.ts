/**
 * M04/M05 pure cores — validation, KYC state machine, slug allocation.
 * No DB here so the rules are fully unit-testable. Spec: PART II M04/M05.
 */

// ---- PAN / GSTIN validation ----------------------------------------------

/** Indian PAN: 5 letters, 4 digits, 1 letter. 4th char encodes holder type. */
export function isValidPan(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
}

/**
 * GSTIN: 2-digit state code + 10-char PAN + entity digit + 'Z' + checksum char.
 * Validates structure AND the mod-36 checksum (last char).
 */
export function isValidGstin(gstin: string): boolean {
  if (!/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/.test(gstin)) return false;
  const chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const body = gstin.slice(0, 14);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const v = chars.indexOf(body[i]!);
    const factor = i % 2 === 0 ? 1 : 2;
    const prod = v * factor;
    sum += Math.floor(prod / 36) + (prod % 36);
  }
  const checkDigit = (36 - (sum % 36)) % 36;
  return chars[checkDigit] === gstin[14];
}

// ---- KYC state machine ----------------------------------------------------

export type SellerStatus =
  | "DRAFT"
  | "KYC_PENDING"
  | "APPROVED"
  | "SUSPENDED"
  | "REJECTED";

export type KycAction = "SUBMIT" | "APPROVE" | "REJECT" | "SUSPEND" | "REINSTATE" | "RESUBMIT";

/** Legal transitions (spec: DRAFT→KYC_PENDING→APPROVED⇄SUSPENDED; REJECTED→resubmit). */
const KYC_TRANSITIONS: Record<SellerStatus, Partial<Record<KycAction, SellerStatus>>> = {
  DRAFT: { SUBMIT: "KYC_PENDING" },
  KYC_PENDING: { APPROVE: "APPROVED", REJECT: "REJECTED" },
  APPROVED: { SUSPEND: "SUSPENDED" },
  SUSPENDED: { REINSTATE: "APPROVED" },
  REJECTED: { RESUBMIT: "KYC_PENDING" },
};

export function canTransition(from: SellerStatus, action: KycAction): boolean {
  return KYC_TRANSITIONS[from]?.[action] != null;
}

export function nextStatus(from: SellerStatus, action: KycAction): SellerStatus | null {
  return KYC_TRANSITIONS[from]?.[action] ?? null;
}

// ---- Slug allocation ------------------------------------------------------

/** Normalise a shop name to a base slug. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "shop";
}

/**
 * Allocate a unique slug given the set of taken slugs. Collision → '-2', '-3'…
 * Pure: the caller supplies the taken set (queried transactionally in the svc).
 */
export function allocateSlug(name: string, taken: Set<string>): string {
  const base = slugify(name);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}
