// PREVIEW ONLY — demo data stands in for real APIs until Steps 2–3 (search/listings).
// Layout matches WIREFRAMES.md screen 1.
const CITY = { name: "Bijnor", state: "Uttar Pradesh" };
const categories = [
  { name: "Fashion", icon: "👕" }, { name: "Electronics", icon: "📱" },
  { name: "Mobiles", icon: "🔋" }, { name: "Grocery", icon: "🛒" },
  { name: "Home", icon: "🏠" }, { name: "Beauty", icon: "💄" },
  { name: "Sports", icon: "🏏" }, { name: "Toys", icon: "🧸" },
];
const shops = [
  { name: "Bagga Cloth", rating: 4.5, reviews: 62, km: 1.2, cat: "Fashion" },
  { name: "City Sports", rating: 4.2, reviews: 31, km: 2.5, cat: "Sports" },
  { name: "Electro Hub", rating: 4.7, reviews: 120, km: 0.8, cat: "Electronics" },
  { name: "Fashion Hub", rating: 4.0, reviews: 48, km: 3.1, cat: "Fashion" },
];
const products = [
  { name: "Men's Cotton Shirt", price: 799, mrp: 1199, shop: "Bagga Cloth", eta: "90 min", stock: "In stock", img: "👕", off: 33 },
  { name: "Nike Air Max 270", price: 3299, mrp: 4999, shop: "City Sports", eta: "90 min", stock: "In stock", img: "👟", off: 34 },
  { name: "Mixer Grinder", price: 2499, mrp: 3299, shop: "Electro Hub", eta: "1 hr", stock: "In stock", img: "🔌", off: 24 },
  { name: "Cotton Kurta", price: 599, mrp: 999, shop: "Fashion Hub", eta: "90 min", stock: "3 left", img: "🧥", off: 40 },
  { name: "Bluetooth Earbuds", price: 1299, mrp: 2499, shop: "Electro Hub", eta: "1 hr", stock: "In stock", img: "🎧", off: 48 },
  { name: "Cricket Bat", price: 1899, mrp: 2599, shop: "City Sports", eta: "2 hr", stock: "In stock", img: "🏏", off: 27 },
];
const inr = (p: number) => "₹" + p.toLocaleString("en-IN");

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="text-2xl font-bold text-teal-700">🛍 ApnaCity</div>
          <button className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm hover:bg-gray-50">
            📍 {CITY.name}, {CITY.state} ▾
          </button>
          <div className="flex min-w-40 flex-1">
            <input className="w-full rounded-l-full border py-2 pl-4 text-sm outline-none focus:border-teal-600"
              placeholder="Search products, brands, shops…" />
            <button className="rounded-r-full bg-teal-700 px-4 text-white">🔍</button>
          </div>
          <button className="rounded-full border px-3 py-1.5 text-sm">EN | हिं</button>
          <button className="rounded-full bg-amber-500 px-4 py-1.5 text-sm font-semibold text-white">🛒 Cart (3)</button>
        </div>
      </header>
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 text-sm">
          <span className="rounded-full bg-teal-50 px-3 py-1 font-medium text-teal-700">All</span>
          {categories.map((c) => (
            <span key={c.name} className="whitespace-nowrap rounded-full px-3 py-1 hover:bg-gray-100">
              {c.icon} {c.name}
            </span>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <section className="rounded-2xl bg-gradient-to-r from-teal-700 to-teal-500 p-8 text-white">
          <h1 className="text-3xl font-bold">आपका शहर, आपकी दुकानें</h1>
          <p className="mt-2 text-teal-50">
            Shop from real local stores in {CITY.name} — compare prices across shops, delivered today.
          </p>
          <p className="mt-3 inline-block rounded-lg bg-white/20 px-3 py-1 text-xs">
            PREVIEW · demo data · real APIs arrive with Steps 2–3
          </p>
        </section>

        <h2 className="mb-3 mt-8 text-lg font-semibold">Featured shops in {CITY.name}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {shops.map((s) => (
            <div key={s.name} className="rounded-xl border bg-white p-4 hover:shadow">
              <div className="text-3xl">🏪</div>
              <div className="mt-2 font-semibold">{s.name}</div>
              <div className="text-sm text-gray-500">{s.cat}</div>
              <div className="mt-1 text-sm">⭐ {s.rating} ({s.reviews}) · {s.km} km</div>
            </div>
          ))}
        </div>

        <h2 className="mb-3 mt-8 text-lg font-semibold">Popular products</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {products.map((p) => (
            <div key={p.name} className="rounded-xl border bg-white p-3 hover:shadow">
              <div className="flex h-20 items-center justify-center text-4xl">{p.img}</div>
              <div className="mt-2 truncate text-sm font-medium">{p.name}</div>
              <div className="text-xs text-gray-500">{p.shop}</div>
              <div className="mt-1">
                <span className="font-semibold">{inr(p.price)}</span>{" "}
                <span className="text-xs text-gray-400 line-through">{inr(p.mrp)}</span>{" "}
                <span className="text-xs font-semibold text-green-700">{p.off}% OFF</span>
              </div>
              <div className="mt-1 text-xs">
                {p.stock === "In stock" ? "🟢" : "🟡"} {p.stock} · 🛵 {p.eta}
              </div>
              <button className="mt-2 w-full rounded-full bg-teal-700 py-1 text-xs font-semibold text-white">
                Add to Cart
              </button>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t bg-white py-6 text-center text-sm text-gray-500">
        ApnaCity — Hyperlocal marketplace · your city, your shops, delivered · PREVIEW BUILD
      </footer>
    </div>
  );
}

