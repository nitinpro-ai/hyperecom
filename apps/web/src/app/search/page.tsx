"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { clientApi, getCityId } from "../../lib/session";

interface Hit { productId: string; name: string; shopId: string; listingVariantId: string; pricePaise: number; mrpPaise: number; inStock: boolean }
const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

function Results() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const shopId = params.get("shopId") ?? "";
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    const api = clientApi();
    const cityId = getCityId();
    setBusy(true);
    const extra: Record<string, string> = {};
    if (cityId) extra.cityId = cityId;
    if (shopId) extra.shopId = shopId;
    // shop browse: empty q still lists that shop's items; search uses "" = all
    api.search(q, extra).then((r) => setHits(r)).catch(() => setHits([])).finally(() => setBusy(false));
  }, [q, shopId]);

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
      <form action="/search" className="mb-4 flex items-center rounded-full border border-line bg-surface">
        <input name="q" defaultValue={q} placeholder="Search products…" className="w-full bg-transparent px-4 py-2.5 outline-none" />
        <button className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white">Search</button>
      </form>
      <h1 className="mb-3 text-lg font-bold">{q ? `Results for “${q}”` : "All products"}</h1>
      {busy ? <p className="text-ink-3">Searching…</p> : hits.length === 0 ? (
        <p className="text-ink-3">No products found{q && ` for “${q}”`}. Try a different term.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {hits.map((h) => (
            <a key={h.listingVariantId} href={`/product/${h.productId}`} className="flex flex-col overflow-hidden rounded-[var(--r-md)] border border-line bg-surface transition hover:shadow-[var(--shadow-hover)]">
              <div className="img-ph aspect-square" />
              <div className="flex flex-1 flex-col p-3">
                <div className="line-clamp-2 min-h-[2.5rem] text-sm font-medium">{h.name}</div>
                <div className="mt-1.5">
                  <span className="font-bold">{inr(h.pricePaise)}</span>{" "}
                  {h.mrpPaise > h.pricePaise && <span className="text-xs text-ink-3 line-through">{inr(h.mrpPaise)}</span>}
                </div>
                <div className="mt-1 text-xs">{h.inStock ? <span className="text-ok">● In stock</span> : <span className="text-ink-3">Out of stock</span>}</div>
                <span className="mt-2 block rounded-full border border-accent bg-accent/5 py-1.5 text-center text-xs font-bold text-accent-dark">Compare shops</span>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-3"><a href="/" className="text-xl font-extrabold text-brand">🛍 ApnaCity</a></div>
      </header>
      <Suspense fallback={<p className="p-6 text-ink-3">Loading…</p>}><Results /></Suspense>
    </div>
  );
}
