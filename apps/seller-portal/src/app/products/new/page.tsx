"use client";
import { useEffect, useState } from "react";
import { clientApi, discountPct, getSession, inr, WEB_MARKETPLACE_URL } from "../../../lib/session";
import { SellerShell } from "../../../components/seller-shell";

export default function NewProduct() {
  const [overview, setOverview] = useState<Awaited<ReturnType<ReturnType<typeof clientApi>["sellerMe"]>> | null>(null);
  const [cats, setCats] = useState<Array<{ id: string; name: string; slug: string }>>([]);
  const [f, setF] = useState({
    shopId: "",
    categoryId: "",
    name: "",
    description: "",
    gtin: "",
    sellerSku: "",
    mrp: "999",
    price: "799",
    initialStock: "25",
  });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ productId: string; listingId: string; matched: string } | null>(null);

  useEffect(() => {
    if (!getSession()) {
      location.href = "/login";
      return;
    }
    const api = clientApi();
    Promise.all([api.sellerMe(), api.categories()])
      .then(([ov, c]) => {
        setOverview(ov);
        setCats(c);
        setF((prev) => ({
          ...prev,
          shopId: prev.shopId || ov.shops[0]?.id || "",
          categoryId: prev.categoryId || c[0]?.id || "",
        }));
      })
      .catch(() => {});
  }, []);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    if (!getSession()) {
      location.href = "/login";
      return;
    }
    const mrpPaise = Math.round(Number(f.mrp) * 100);
    const pricePaise = Math.round(Number(f.price) * 100);
    if (pricePaise > mrpPaise || pricePaise <= 0) {
      setMsg("Error: Selling price must be greater than ₹0 and cannot exceed MRP.");
      return;
    }
    setBusy(true); setMsg(""); setDone(null);
    try {
      const api = clientApi();
      const autoSku = f.sellerSku.trim() || `SKU-${f.name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 6)}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      const p = await api.createProduct({
        categoryId: f.categoryId,
        name: f.name.trim(),
        description: f.description.trim() || undefined,
        gtin: f.gtin.trim() || undefined,
        variant: { sku: autoSku },
      });
      const d = await api.createListingDraft(f.shopId, {
        productId: p.productId,
        variants: [{ variantId: p.variantId, sellerSku: autoSku, mrpPaise, pricePaise }],
      });
      await api.publishListing(d.listingId, 1, Math.max(1, Math.round(Number(f.initialStock) || 25)));
      setDone({ productId: p.productId, listingId: d.listingId, matched: p.matched });
      setMsg(`🎉 Published! "${f.name}" is now LIVE on your shop website and city search with ${f.initialStock || 25} units in stock.`);
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const activeShop = overview?.shops.find((s) => s.id === f.shopId) ?? overview?.shops[0] ?? null;
  const mrpPaisePreview = Math.round((Number(f.mrp) || 0) * 100);
  const pricePaisePreview = Math.round((Number(f.price) || 0) * 100);
  const offPreview = discountPct(pricePaisePreview, mrpPaisePreview);
  const selectedCatName = cats.find((c) => c.id === f.categoryId)?.name ?? "Category";

  return (
    <SellerShell
      active="new-product"
      userName={overview?.user?.name}
      sellerName={overview?.seller?.displayName}
      kycStatus={overview?.seller?.status}
      activeShop={activeShop}
      pendingOrdersCount={overview?.stats.pendingOrders ?? 0}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800">
              ✨ 1-Step Product Publishing Studio
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Add a New Product</h1>
            <p className="text-sm text-slate-500">Match or create a master product, set your shop price &amp; initial stock, and publish immediately.</p>
          </div>
          <a href="/products" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
            ← Back to Catalogue
          </a>
        </div>

        {overview && overview.shops.length === 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 flex items-center justify-between">
            <div className="text-xs text-amber-900">
              <b>You haven&apos;t opened a shop yet!</b> Complete onboarding first so your products have a storefront to belong to.
            </div>
            <a href="/register" className="rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-slate-950">Open Shop →</a>
          </div>
        )}

        <div className="grid lg:grid-cols-12 gap-6 items-start">
          <form onSubmit={publish} className="lg:col-span-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Storefront *</label>
                <select required value={f.shopId} onChange={(e) => setF({ ...f, shopId: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white">
                  {overview?.shops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.cityName})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Marketplace Category *</label>
                <select required value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white">
                  {cats.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Title *</label>
              <input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Premium Banarasi Silk Saree — Royal Crimson" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Description &amp; Highlights</label>
              <textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Authentic local stock, same-day city delivery, warranty included…" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">GTIN / Barcode (Optional)</label>
                  <button type="button" onClick={() => setF({ ...f, gtin: `890${String(Date.now()).slice(-10)}` })} className="text-[11px] font-bold text-teal-700 hover:underline">
                    Generate EAN-13
                  </button>
                </div>
                <input value={f.gtin} onChange={(e) => setF({ ...f, gtin: e.target.value })} placeholder="Auto-matches shared products" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Seller SKU (Auto-generated if blank)</label>
                <input value={f.sellerSku} onChange={(e) => setF({ ...f, sellerSku: e.target.value })} placeholder="e.g. BGH-SAREE-01" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">MRP (₹) *</label>
                <input required type="number" min={1} value={f.mrp} onChange={(e) => setF({ ...f, mrp: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price (₹) *</label>
                <input required type="number" min={1} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} className="w-full rounded-xl border border-teal-500 bg-teal-50/30 px-3.5 py-2.5 text-sm font-extrabold text-teal-900" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Stock *</label>
                <input required type="number" min={1} value={f.initialStock} onChange={(e) => setF({ ...f, initialStock: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-bold" />
              </div>
            </div>

            <button type="submit" disabled={busy || !f.shopId || !f.categoryId || !f.name} className="w-full rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 py-3.5 text-sm font-extrabold text-white shadow-md disabled:opacity-50 transition">
              {busy ? "Publishing to Storefront & City Search…" : "🚀 Publish Product Live Now"}
            </button>

            {msg && (
              <div className={`rounded-2xl border p-4 text-xs font-semibold ${done ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
                <div>{msg}</div>
                {done && (
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <a href={`${WEB_MARKETPLACE_URL}/product/${done.productId}`} target="_blank" rel="noreferrer" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white">
                      View Live on Marketplace ↗
                    </a>
                    <a href="/products" className="rounded-lg border border-emerald-400 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900">
                      Go to Catalogue
                    </a>
                  </div>
                )}
              </div>
            )}
          </form>

          <div className="lg:col-span-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Live Marketplace Preview</div>
            <div className="h-40 rounded-2xl bg-gradient-to-br from-teal-50 via-emerald-50/70 to-amber-50/60 border border-teal-100 flex flex-col items-center justify-center p-4 text-center">
              <span className="text-3xl mb-1">🛍️</span>
              <span className="text-xs font-bold text-teal-800 line-clamp-2">{f.name || "Your Product Title"}</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span className="rounded bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">{selectedCatName}</span>
              <span>📍 {activeShop?.name ?? "Your Shop"}</span>
            </div>
            <div className="font-bold text-slate-900 text-base truncate">{f.name || "Your Product Title"}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-slate-900">{inr(pricePaisePreview)}</span>
              {mrpPaisePreview > pricePaisePreview && <span className="text-xs text-slate-400 line-through">{inr(mrpPaisePreview)}</span>}
              {offPreview > 0 && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-800">{offPreview}% OFF</span>}
            </div>
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-emerald-700 font-semibold">
              <span>● {f.initialStock || 25} units in stock</span>
              <span>Same-day city delivery</span>
            </div>
          </div>
        </div>
      </div>
    </SellerShell>
  );
}

