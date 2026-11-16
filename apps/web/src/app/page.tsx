import { TopBar, ProductImage, StarRating, StockBadge, Price, Section } from "../components/ui";

export const dynamic = "force-dynamic";

const CITY = { name: "Bijnor", state: "Uttar Pradesh" };

const categories = [
  { name: "Fashion", key: "fashion" }, { name: "Mobiles", key: "mobiles" },
  { name: "Electronics", key: "electronics" }, { name: "Grocery", key: "grocery" },
  { name: "Home", key: "home" }, { name: "Beauty", key: "beauty" },
  { name: "Sports", key: "sports" }, { name: "Toys", key: "toys" },
];

const shops = [
  { name: "Bagga Cloth", cat: "Fashion", rating: 4.5, reviews: 62, km: 1.2 },
  { name: "Electro Hub", cat: "Electronics", rating: 4.7, reviews: 120, km: 0.8 },
  { name: "City Sports", cat: "Sports", rating: 4.2, reviews: 31, km: 2.5 },
  { name: "Fashion Hub", cat: "Fashion", rating: 4.0, reviews: 48, km: 3.1 },
];

const products = [
  { id: "demo", name: "Men's Cotton Shirt — Regular Fit", shop: "Bagga Cloth", price: 76900, mrp: 119900, rating: 4.4, stock: 25, eta: "90 min", shops: 3 },
  { id: "demo", name: "Nike Air Max 270 Running Shoes", shop: "City Sports", price: 329900, mrp: 499900, rating: 4.6, stock: 8, eta: "2 hr", shops: 2 },
  { id: "demo", name: "Mixer Grinder 750W 3-Jar", shop: "Electro Hub", price: 249900, mrp: 329900, rating: 4.3, stock: 12, eta: "1 hr", shops: 4 },
  { id: "demo", name: "Cotton Kurta — Festive", shop: "Fashion Hub", price: 59900, mrp: 99900, rating: 4.1, stock: 3, eta: "90 min", shops: 2 },
  { id: "demo", name: "boAt Bluetooth Earbuds", shop: "Electro Hub", price: 129900, mrp: 249900, rating: 4.5, stock: 40, eta: "1 hr", shops: 5 },
  { id: "demo", name: "Kashmir Willow Cricket Bat", shop: "City Sports", price: 189900, mrp: 259900, rating: 4.2, stock: 15, eta: "2 hr", shops: 2 },
];

export default function HomePage() {
  return (
    <div className="min-h-screen">
      <TopBar city={CITY.name} state={CITY.state} cartCount={3} />

      {/* category rail */}
      <nav className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2 sm:px-4 [scrollbar-width:none]">
          <span className="whitespace-nowrap rounded-full bg-brand-tint px-3 py-1.5 text-sm font-semibold text-brand">All</span>
          {categories.map((c) => (
            <span key={c.key} className="cursor-pointer whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-ink-2 hover:bg-gray-100">{c.name}</span>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4">
        {/* hero */}
        <section className="overflow-hidden rounded-[var(--r-lg)] bg-gradient-to-br from-brand-dark via-brand to-[#139b8d] p-6 text-white shadow-[var(--shadow-card)] sm:p-9">
          <p className="text-xs font-semibold uppercase tracking-wider text-white/70">Hyperlocal · {CITY.name}</p>
          <h1 className="mt-1 text-2xl font-extrabold leading-tight sm:text-4xl">आपका शहर, आपकी दुकानें</h1>
          <p className="mt-2 max-w-md text-sm text-white/85 sm:text-base">
            Real local shops near you — compare prices across stores and get it delivered today.
          </p>
          <div className="mt-4 flex gap-2">
            <button className="rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-accent-dark">Start shopping</button>
            <button className="rounded-full bg-white/15 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur hover:bg-white/25">Sell on ApnaCity</button>
          </div>
        </section>

        {/* trust strip */}
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Same-day delivery", "from shops near you"],
            ["Compare real prices", "across local stores"],
            ["Pay on delivery", "COD available"],
            ["Verified shops", "KYC-checked sellers"],
          ].map(([t, s]) => (
            <div key={t} className="flex items-center gap-2 rounded-[var(--r-sm)] border border-line bg-surface px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-tint text-brand">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6 9 17l-5-5"/></svg>
              </span>
              <div className="min-w-0"><div className="truncate text-xs font-semibold text-ink">{t}</div><div className="truncate text-[11px] text-ink-3">{s}</div></div>
            </div>
          ))}
        </div>

        {/* featured shops */}
        <Section title={`Popular shops in ${CITY.name}`} action={<a href="#" className="text-sm font-semibold text-brand">See all</a>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {shops.map((s) => (
              <a key={s.name} href="/shop/bagga-cloth" className="group rounded-[var(--r-md)] border border-line bg-surface p-3 transition hover:shadow-[var(--shadow-hover)]">
                <div className="flex items-center gap-3">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-tint text-base font-bold text-brand">{s.name[0]}</span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">{s.name}</div>
                    <div className="text-xs text-ink-3">{s.cat}</div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <StarRating value={s.rating} count={s.reviews} />
                  <span className="text-xs text-ink-3">{s.km} km</span>
                </div>
              </a>
            ))}
          </div>
        </Section>

        {/* product grid */}
        <Section title="Trending near you" action={<a href="#" className="text-sm font-semibold text-brand">See all</a>}>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p, i) => (
              <a key={i} href={`/product/${p.id}`} className="group flex flex-col overflow-hidden rounded-[var(--r-md)] border border-line bg-surface transition hover:shadow-[var(--shadow-hover)]">
                <div className="relative">
                  <ProductImage className="aspect-square w-full" />
                  <span className="absolute left-2 top-2 rounded bg-save px-1.5 py-0.5 text-[11px] font-bold text-white">{discountBadge(p.price, p.mrp)}</span>
                </div>
                <div className="flex flex-1 flex-col p-3">
                  <div className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-ink">{p.name}</div>
                  <div className="mt-0.5 text-xs text-ink-3">{p.shop} · {p.shops} shops</div>
                  <div className="mt-1.5"><Price price={p.price} mrp={p.mrp} /></div>
                  <div className="mt-1.5 flex items-center justify-between">
                    <StarRating value={p.rating} />
                    <StockBadge available={p.stock} />
                  </div>
                  <div className="mt-1 text-[11px] text-ink-3">🛵 Delivery in {p.eta}</div>
                  <span className="mt-2.5 block rounded-full border border-accent bg-accent/5 py-1.5 text-center text-xs font-bold text-accent-dark group-hover:bg-accent group-hover:text-white">Compare shops</span>
                </div>
              </a>
            ))}
          </div>
        </Section>
      </main>

      <footer className="mt-10 border-t border-line bg-surface py-8">
        <div className="mx-auto max-w-6xl px-4 text-center">
          <div className="text-lg font-extrabold text-brand">ApnaCity</div>
          <p className="mt-1 text-sm text-ink-3">Your city. Your shops. Delivered.</p>
        </div>
      </footer>
    </div>
  );
}

function discountBadge(price: number, mrp: number): string {
  const off = mrp <= 0 ? 0 : Math.round(((mrp - price) / mrp) * 100);
  return `${off}% OFF`;
}
