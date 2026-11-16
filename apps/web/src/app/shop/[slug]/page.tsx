import { api, safe } from "../../../lib/api";
import { ProductImage, StarRating, Price } from "../../../components/ui";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

const DEMO_SHOP = { id: "demo-shop", slug: "bagga-cloth", name: "Bagga Cloth", cityId: "bijnor", status: "ACTIVE" };
const DEMO_CATALOGUE = [
  { listingId: "l1", productId: "demo", title: "Men's Cotton Shirt — Regular Fit", slug: "s1", pricePaise: 79900, mrpPaise: 119900 },
  { listingId: "l2", productId: "demo", title: "Cotton Kurta — Festive", slug: "s2", pricePaise: 59900, mrpPaise: 99900 },
  { listingId: "l3", productId: "demo", title: "Slim-Fit Denim Jeans", slug: "s3", pricePaise: 149900, mrpPaise: 199900 },
  { listingId: "l4", productId: "demo", title: "Linen Casual Shirt", slug: "s4", pricePaise: 89900, mrpPaise: 134900 },
];

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const shop = await safe(() => api.resolveStorefront(slug), DEMO_SHOP);
  const title = `${shop.name} — online store on ApnaCity`;
  return { title, description: `Shop ${shop.name} online and get local delivery.`, alternates: { canonical: `https://${slug}.apnacity.com` } };
}

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const shop = await safe(() => api.resolveStorefront(slug), DEMO_SHOP);
  const catalogue = await safe(() => api.shopCatalogue(shop.id), DEMO_CATALOGUE);
  const jsonLd = { "@context": "https://schema.org", "@type": "Store", name: shop.name, url: `https://${slug}.apnacity.com` };

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* branded banner */}
      <div className="h-28 bg-gradient-to-br from-brand-dark via-brand to-[#139b8d] sm:h-36" />
      <div className="mx-auto max-w-6xl px-3 sm:px-4">
        <div className="-mt-10 flex items-end gap-4">
          <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border-4 border-surface bg-brand-tint text-3xl font-extrabold text-brand shadow-[var(--shadow-card)]">{shop.name[0]}</span>
          <div className="pb-1">
            <h1 className="text-xl font-extrabold text-ink sm:text-2xl">{shop.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
              <StarRating value={4.5} count={62} />
              <span>·</span><span>{slug}.apnacity.com</span>
              <span className={`rounded px-1.5 py-0.5 font-semibold ${shop.status === "ACTIVE" ? "bg-ok/10 text-ok" : "bg-gray-100 text-ink-3"}`}>{shop.status === "ACTIVE" ? "Open now" : shop.status}</span>
            </div>
          </div>
        </div>

        {/* shop meta */}
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 border-y border-line py-3 text-xs text-ink-2">
          <span>🛵 Delivery in 90 min</span><span>📍 1.2 km away</span><span>✓ KYC-verified seller</span><span>↩ 7-day returns</span>
        </div>

        <nav className="mt-3 flex gap-5 text-sm">
          <span className="border-b-2 border-brand pb-2 font-semibold text-brand">Products</span>
          <span className="pb-2 text-ink-3">About</span><span className="pb-2 text-ink-3">Policies</span><span className="pb-2 text-ink-3">Hours</span>
        </nav>

        <h2 className="mb-3 mt-5 text-base font-bold text-ink sm:text-lg">All products</h2>
        <div className="grid grid-cols-2 gap-3 pb-10 sm:grid-cols-3 lg:grid-cols-4">
          {catalogue.map((p) => (
            <a key={p.listingId} href={`/product/${p.productId}`} className="group flex flex-col overflow-hidden rounded-[var(--r-md)] border border-line bg-surface transition hover:shadow-[var(--shadow-hover)]">
              <ProductImage className="aspect-square w-full" />
              <div className="flex flex-1 flex-col p-3">
                <div className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-ink">{p.title}</div>
                <div className="mt-1.5">{p.pricePaise != null && <Price price={p.pricePaise} mrp={p.mrpPaise ?? p.pricePaise} />}</div>
                <span className="mt-2.5 block rounded-full border border-accent bg-accent/5 py-1.5 text-center text-xs font-bold text-accent-dark group-hover:bg-accent group-hover:text-white">View item</span>
              </div>
            </a>
          ))}
          {catalogue.length === 0 && <p className="col-span-full py-10 text-center text-ink-3">This shop hasn't published any products yet.</p>}
        </div>
      </div>

      <footer className="border-t border-line bg-surface py-6 text-center text-sm text-ink-3">
        {shop.name} · powered by <span className="font-semibold text-brand">ApnaCity</span>
      </footer>
    </div>
  );
}
