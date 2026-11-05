/**
 * Shared design system (Step 5+ grows this: components, Hindi font setup,
 * theme tokens from shop_settings). Step 1 baseline exports only primitives
 * so every Next.js app compiles against it.
 */

export const brand = {
  name: "ApnaCity",
  tagline: { EN: "Your city. Your shops. Delivered.", HI: "आपका शहर। आपकी दुकानें।" },
  colors: {
    primary: "#0F766E",
    accent: "#F59E0B",
    ink: "#111827",
    muted: "#6B7280",
  },
} as const;

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
