import type { ReactNode } from "react";
import { CityPicker } from "./city-picker";

export const inr = (paise: number | null | undefined): string =>
  paise == null ? "—" : "₹" + Math.round(paise / 100).toLocaleString("en-IN");

export const discountPct = (pricePaise: number, mrpPaise: number): number =>
  mrpPaise <= 0 ? 0 : Math.round(((mrpPaise - pricePaise) / mrpPaise) * 100);

/** Marketplace top bar: brand, city, search, cart. Sticky, mobile-first. */
export function TopBar({ city = "Bijnor", state = "Uttar Pradesh", cartCount = 0 }: { city?: string; state?: string; cartCount?: number }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
        <a href="/" className="flex items-center gap-1.5 text-xl font-extrabold tracking-tight text-brand">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-surface">A</span>
          <span className="hidden sm:inline">ApnaCity</span>
        </a>
        <CityPicker initialCity={city} />
        <form action="/search" className="flex min-w-0 flex-1 items-center rounded-full border border-line bg-surface focus-within:border-brand">
          <svg className="ml-3 shrink-0 text-ink-3" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <input name="q" className="w-full bg-transparent px-2 py-2 text-sm outline-none placeholder:text-ink-3" placeholder="Search shirts, mobiles, grocery…" />
        </form>
        <a href="/login" className="hidden shrink-0 rounded-full border border-line px-3 py-2 text-sm font-medium text-ink-2 hover:border-brand sm:inline">Login</a>
        <a href="/cart" className="relative shrink-0 rounded-full bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-dark">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 002 1.6h9.7a2 2 0 002-1.6L23 6H6"/></svg>
          {cartCount > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">{cartCount}</span>}
        </a>
      </div>
    </header>
  );
}

/** A product image placeholder with a label (until real uploads land). */
export function ProductImage({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`img-ph flex items-center justify-center overflow-hidden ${className}`}>
      {label ? (
        <span className="relative z-10 px-3 text-center text-sm font-semibold text-brand/70">{label}</span>
      ) : (
        <svg className="relative z-10 text-brand/30" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
      )}
    </div>
  );
}

export function StarRating({ value, count }: { value: number; count?: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-ok/10 px-1.5 py-0.5 text-xs font-semibold text-ok">
      {value.toFixed(1)}
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1z"/></svg>
      {count != null && <span className="font-normal text-ink-3">({count})</span>}
    </span>
  );
}

export function StockBadge({ available }: { available: number }) {
  if (available <= 0) return <span className="text-xs font-medium text-ink-3">Out of stock</span>;
  if (available <= 3) return <span className="text-xs font-semibold text-warn">Only {available} left</span>;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-ok">
      <span className="h-1.5 w-1.5 rounded-full bg-ok" /> In stock
    </span>
  );
}

export function Price({ price, mrp, size = "md" }: { price: number; mrp: number; size?: "sm" | "md" | "lg" }) {
  const off = discountPct(price, mrp);
  const cls = size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-base";
  return (
    <div className="flex flex-wrap items-baseline gap-1.5">
      <span className={`font-bold text-ink ${cls}`}>{inr(price)}</span>
      {mrp > price && <span className="text-xs text-ink-3 line-through">{inr(mrp)}</span>}
      {off > 0 && <span className="text-xs font-bold text-save">{off}% off</span>}
    </div>
  );
}

export function Section({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-ink sm:text-lg">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
