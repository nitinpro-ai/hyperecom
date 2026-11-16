import { api, safe } from "../../../lib/api";
import { TopBar, ProductImage, StarRating, StockBadge, Price, inr, discountPct } from "../../../components/ui";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Offer {
  listingVariantId: string; listingId: string; shopId: string;
  pricePaise: number; mrpPaise: number;
  shopName?: string; distanceKm?: number; etaMin?: number; rating?: number;
}

const DEMO_PRODUCT = {
  id: "demo", name: "Men's Cotton Shirt — Regular Fit (Blue)", slug: "mens-cotton-shirt",
  description: "100% combed cotton, breathable regular-fit shirt with a classic collar. Sold by several verified local shops — pick the best price and fastest delivery.",
  gtin: null as string | null, attributes: {} as unknown,
  brand: { name: "LocalWear", slug: "localwear" },
  category: { id: "c", name: "Fashion", slug: "fashion" },
  variants: [
    { id: "v-s", sku: "SKU-S", attributes: { size: "S" } },
    { id: "v-m", sku: "SKU-M", attributes: { size: "M" } },
    { id: "v-l", sku: "SKU-L", attributes: { size: "L" } },
    { id: "v-xl", sku: "SKU-XL", attributes: { size: "XL" } },
  ],
  status: "ACTIVE",
};
const DEMO_OFFERS: Offer[] = [
  { listingVariantId: "o3", listingId: "l3", shopId: "s3", pricePaise: 76900, mrpPaise: 119900, shopName: "City Traders", distanceKm: 2.0, etaMin: 75, rating: 4.3 },
  { listingVariantId: "o1", listingId: "l1", shopId: "s1", pricePaise: 79900, mrpPaise: 119900, shopName: "Bagga Cloth", distanceKm: 1.2, etaMin: 90, rating: 4.5 },
  { listingVariantId: "o2", listingId: "l2", shopId: "s2", pricePaise: 84900, mrpPaise: 119900, shopName: "Fashion Hub", distanceKm: 3.1, etaMin: 120, rating: 4.0 },
];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = await safe(() => api.product(id), DEMO_PRODUCT);
  return { title: `${product.name} — best local prices on ApnaCity`, description: product.description ?? undefined };
}

export default async function ProductPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ variantId?: string; cityId?: string }>;
}) {
  const { id } = await params;
  const { variantId, cityId } = await searchParams;
  const product = await safe(() => api.product(id), DEMO_PRODUCT);
  const selectedVariant = variantId ?? product.variants[0]?.id ?? "";
  const rawOffers: Offer[] = await safe(
    () => api.offers(id, selectedVariant, cityId).then((l) => l.map((o): Offer => ({ ...o }))),
    DEMO_OFFERS,
  );
  const offers = [...rawOffers].sort((a, b) => a.pricePaise - b.pricePaise);
  const best = offers[0];
  const fastest = [...offers].sort((a, b) => (a.etaMin ?? 1e9) - (b.etaMin ?? 1e9))[0];

  const jsonLd = {
    "@context": "https://schema.org", "@type": "Product", name: product.name,
    description: product.description ?? undefined, brand: product.brand?.name,
    offers: best ? { "@type": "AggregateOffer", priceCurrency: "INR", lowPrice: (best.pricePaise / 100).toFixed(2), highPrice: ((offers[offers.length - 1]?.pricePaise ?? best.pricePaise) / 100).toFixed(2), offerCount: offers.length } : undefined,
  };

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <TopBar cartCount={3} />

      <nav className="mx-auto max-w-6xl px-3 pt-3 text-xs text-ink-3 sm:px-4">
        <a href="/" className="hover:text-brand">Home</a> › <span>{product.category.name}</span> › <span className="text-ink-2">{product.name}</span>
      </nav>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
        <div className="grid gap-6 md:grid-cols-2">
          {/* gallery */}
          <div>
            <ProductImage label={product.name} className="aspect-square w-full rounded-[var(--r-lg)] border border-line" />
            <div className="mt-3 flex gap-2">
              {[0, 1, 2, 3].map((i) => (
                <ProductImage key={i} className={`h-16 w-16 rounded-[var(--r-sm)] border ${i === 0 ? "border-brand" : "border-line"}`} />
              ))}
            </div>
          </div>

          {/* summary */}
          <div>
            {product.brand && <div className="text-sm font-medium text-brand">{product.brand.name}</div>}
            <h1 className="mt-0.5 text-xl font-bold leading-snug text-ink sm:text-2xl">{product.name}</h1>
            <div className="mt-2 flex items-center gap-3">
              <StarRating value={best?.rating ?? 4.3} count={128} />
              <span className="text-xs text-ink-3">Offered by {offers.length} local shops</span>
            </div>

            {best && (
              <div className="mt-3 rounded-[var(--r-md)] border border-line bg-surface p-4">
                <div className="text-xs font-medium text-ink-3">Best price in your city</div>
                <Price price={best.pricePaise} mrp={best.mrpPaise} size="lg" />
                <div className="mt-1 text-xs text-ink-2">at <span className="font-semibold text-ink">{best.shopName ?? "a local shop"}</span>{best.etaMin != null && <> · 🛵 {best.etaMin} min</>}</div>
              </div>
            )}

            <div className="mt-4">
              <div className="mb-1.5 text-sm font-semibold text-ink">Size</div>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => {
                  const label = typeof v.attributes === "object" && v.attributes ? Object.values(v.attributes as Record<string, unknown>).join(" / ") : v.sku ?? v.id;
                  const active = v.id === selectedVariant;
                  return (
                    <a key={v.id} href={`?variantId=${v.id}`} className={`min-w-11 rounded-[var(--r-sm)] border px-3.5 py-2 text-center text-sm ${active ? "border-brand bg-brand-tint font-bold text-brand" : "border-line text-ink-2 hover:border-brand"}`}>{String(label)}</a>
                  );
                })}
              </div>
            </div>

            <p className="mt-4 text-sm leading-relaxed text-ink-2">{product.description}</p>

            {/* trust row */}
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1.5"><Dot/> Pay on delivery</span>
              <span className="inline-flex items-center gap-1.5"><Dot/> 7-day returns</span>
              <span className="inline-flex items-center gap-1.5"><Dot/> Verified sellers</span>
            </div>
          </div>
        </div>

        {/* THE offers comparison — the differentiator */}
        <section className="mt-8">
          <h2 className="text-lg font-bold text-ink">Compare {offers.length} local shops</h2>
          <p className="mb-3 text-sm text-ink-3">Same item, same size — real prices from real shops near you.</p>

          <div className="space-y-2.5">
            {offers.map((o, i) => {
              const isBest = o === best, isFastest = o === fastest && fastest?.etaMin != null;
              return (
                <div key={o.listingVariantId} className={`flex items-center gap-3 rounded-[var(--r-md)] border bg-surface p-3 ${isBest ? "border-save/50 ring-1 ring-save/30" : "border-line"}`}>
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-tint text-sm font-bold text-brand">{(o.shopName ?? "S")[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{o.shopName ?? `Shop ${o.shopId.slice(0, 6)}`}</span>
                      {isBest && <span className="rounded bg-save px-1.5 py-0.5 text-[10px] font-bold text-white">BEST PRICE</span>}
                      {isFastest && !isBest && <span className="rounded bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">FASTEST</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-ink-3">
                      {o.rating != null && <StarRating value={o.rating} />}
                      {o.distanceKm != null && <span>{o.distanceKm} km</span>}
                      {o.etaMin != null && <span>🛵 {o.etaMin} min</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Price price={o.pricePaise} mrp={o.mrpPaise} size="sm" />
                    <button className="mt-1.5 rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-white hover:bg-accent-dark">Add</button>
                  </div>
                </div>
              );
            })}
            {offers.length === 0 && <div className="rounded-[var(--r-md)] border border-line bg-surface p-6 text-center text-ink-3">No shops in your city stock this item yet.</div>}
          </div>
        </section>
      </main>

      {/* sticky mobile buy bar */}
      {best && (
        <div className="fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-line bg-surface/95 p-3 backdrop-blur md:hidden">
          <div className="min-w-0 flex-1"><Price price={best.pricePaise} mrp={best.mrpPaise} /><div className="truncate text-[11px] text-ink-3">best at {best.shopName}</div></div>
          <button className="rounded-full bg-accent px-6 py-3 text-sm font-bold text-white">Add to Cart</button>
        </div>
      )}
    </div>
  );
}

function Dot() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ok"><path d="M20 6 9 17l-5-5"/></svg>; }
