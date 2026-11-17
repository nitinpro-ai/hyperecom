/**
 * M32 content — pure helper: banner active-window check. No DB.
 */
export function bannerActive(
  b: { isActive: boolean; activeFrom?: Date | null; activeTo?: Date | null },
  now = new Date(),
): boolean {
  if (!b.isActive) return false;
  if (b.activeFrom && now < b.activeFrom) return false;
  if (b.activeTo && now > b.activeTo) return false;
  return true;
}
