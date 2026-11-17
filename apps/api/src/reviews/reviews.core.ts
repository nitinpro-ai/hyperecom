/**
 * M21 reviews — pure cores: edit window + exact aggregate recompute. No DB.
 * Spec: PART II M21 (one review/item, verified purchase, exact recompute).
 */

export const EDIT_WINDOW_DAYS = 7;

export function withinEditWindow(createdAt: Date, now = new Date()): boolean {
  return now.getTime() - createdAt.getTime() <= EDIT_WINDOW_DAYS * 24 * 3600 * 1000;
}

/** Exact average (not incremental): mean of all APPROVED ratings, rounded to 2dp. */
export function recomputeAverage(ratings: number[]): { avg: number; count: number } {
  if (ratings.length === 0) return { avg: 0, count: 0 };
  const sum = ratings.reduce((s, r) => s + r, 0);
  return { avg: Math.round((sum / ratings.length) * 100) / 100, count: ratings.length };
}

/** Trivial profanity gate (illustrative; real impl uses a maintained list/service). */
const BLOCKED = ["badword1", "badword2"];
export function needsModeration(text: string | null | undefined): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return BLOCKED.some((w) => lower.includes(w));
}
