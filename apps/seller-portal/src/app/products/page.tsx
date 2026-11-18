"use client";
import { useEffect, useState } from "react";
import { clientApi, discountPct, getSession, inr, WEB_MARKETPLACE_URL } from "../../lib/session";
import { SellerShell } from "../../components/seller-shell";

type ListingRow = Awaited<ReturnType<ReturnType<typeof clientApi>["sellerListings"]>>[number];

export default function SellerProductsPage() {
  const [overview, setOverview] = useState<Awaited<ReturnType<ReturnType<typeof clientApi>["sellerMe"]>> | null>(null);
  const [rows, setRows] = useState<ListingRow[]>([]);
  const [shopId, setShopId] = useState<string>("");
  const [q, setQ] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ mrp: "", price: "", stock: "" });
  const [msg, setMsg] = useState<string>("");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load(selectedShop?: string) {
    if (!getSession()) {
      location.href = "/login";
      return;
    }
    const api = clientApi();
    const [ov, list] = await Promise.all([
      api.sellerMe(),
      api.sellerListings(selectedShop || undefined),
    ]);
    setOverview(ov);
    setRows(list);
  }

  useEffect(() => {
    void load(shopId || undefined);
  }, [shopId]);

  function startEdit(r: ListingRow) {
    setEditId(r.listingId);
    setEditForm({
      mrp: String(Math.round(r.mrpPaise / 100)),
      price: String(Math.round(r.pricePaise / 100)),
      stock: String(r.stockOnHand),
    });
  }

  async function saveEdit(r: ListingRow) {
    setBusyId(r.listingId); setMsg("");
    try {
      await clientApi().updateSellerListing(r.listingId, {
        mrpPaise: Math.round(Number(editForm.mrp) * 100),
        pricePaise: Math.round(Number(editForm.price) * 100),
        stockOnHand: Math.round(Number(editForm.stock)),
      });
      setEditId(null);
      setMsg(`Updated "${r.title}" price & inventory.`);
      await load(shopId || undefined);
    } catch (e) {
      setMsg(`Could not update: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  async function uploadRowPhoto(r: ListingRow, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusyId(r.listingId); setMsg("");
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      const api = clientApi();
      const up = await api.uploadImageBase64({ mime: file.type || "image/jpeg", dataBase64, filename: file.name, shopId: r.shopId });
      await api.updateSellerListing(r.listingId, { imageUrl: up.url });
      setMsg(`📸 Updated photo for "${r.title}".`);
      await load(shopId || undefined);
    } catch (err) {
      setMsg(`Error: ${(err as Error).message}`);
    } finally {
      setBusyId("");
      e.target.value = "";
    }
  }

  async function toggleStatus(r: ListingRow) {
    setBusyId(r.listingId); setMsg("");
    try {
      const next = r.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
      await clientApi().updateSellerListing(r.listingId, { status: next });
      setMsg(`"${r.title}" is now ${next}.`);
      await load(shopId || undefined);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  }

  const filtered = rows.filter((r) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return (
      r.title.toLowerCase().includes(s) ||
      r.sellerSku.toLowerCase().includes(s) ||
      r.categoryName.toLowerCase().includes(s)
    );
  });

  const activeShop = overview?.shops.find((s) => s.id === shopId) ?? overview?.shops[0] ?? null;

  return (
    <SellerShell
      active="products"
      userName={overview?.user?.name}
      sellerName={overview?.seller?.displayName}
      kycStatus={overview?.seller?.status}
      activeShop={activeShop}
      pendingOrdersCount={overview?.stats.pendingOrders ?? 0}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
              📦 Catalogue &amp; Inventory Studio
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Products &amp; Live Stock</h1>
            <p className="text-sm text-slate-500">Manage pricing, discounts, and real-time shelf inventory across your storefronts.</p>
          </div>
          <div className="flex items-center gap-2.5">
            {overview && overview.shops.length > 1 && (
              <select value={shopId} onChange={(e) => setShopId(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800">
                <option value="">All Shops ({overview.shops.length})</option>
                {overview.shops.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.cityName})</option>
                ))}
              </select>
            )}
            <a href="/products/new" className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-sm transition">
              + Add New Product
            </a>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by product title, SKU, or category…"
            className="w-full sm:w-80 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs outline-none focus:border-teal-600 focus:bg-white"
          />
          <div className="flex items-center gap-4 text-xs text-slate-600">
            <span>Total Listed: <b className="text-slate-900">{filtered.length}</b></span>
            <span>Active: <b className="text-emerald-700">{filtered.filter((x) => x.status === "ACTIVE").length}</b></span>
            <span>Low/Out of Stock: <b className="text-amber-700">{filtered.filter((x) => x.stockOnHand <= 3).length}</b></span>
          </div>
        </div>

        {msg && (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900">
            {msg}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="text-4xl">📦</div>
            <h2 className="mt-3 text-lg font-bold text-slate-900">No products in your catalogue yet</h2>
            <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
              Publish your first product — it will immediately go live on your shop website and city search.
            </p>
            <a href="/products/new" className="mt-5 inline-block rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white">
              + Publish First Product →
            </a>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4">Product &amp; Category</th>
                    <th className="py-3.5 px-4">SKU &amp; Shop</th>
                    <th className="py-3.5 px-4">Price / MRP</th>
                    <th className="py-3.5 px-4">Shelf Stock</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filtered.map((r) => {
                    const isEditing = editId === r.listingId;
                    const off = discountPct(r.pricePaise, r.mrpPaise);
                    return (
                      <tr key={r.listingId} className="hover:bg-slate-50/70 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <label className="relative h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden grid place-items-center cursor-pointer group" title="Click to upload/change photo">
                              {r.imageUrl ? (
                                <img src={r.imageUrl} alt={r.title} className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-lg">📷</span>
                              )}
                              <span className="absolute inset-0 bg-slate-900/60 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 grid place-items-center transition">
                                Upload
                              </span>
                              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(e) => uploadRowPhoto(r, e)} className="hidden" />
                            </label>
                            <div>
                              <div className="font-bold text-slate-900">{r.title}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-700">{r.categoryName}</span>
                                {r.gtin && <span className="font-mono text-[11px] text-slate-400">GTIN: {r.gtin}</span>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-xs">
                          <div className="font-mono font-semibold text-slate-800">{r.sellerSku}</div>
                          <div className="text-slate-500">{r.shopName}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <input value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} placeholder="Price ₹" className="w-20 rounded-lg border px-2 py-1 text-xs font-bold" />
                              <input value={editForm.mrp} onChange={(e) => setEditForm({ ...editForm, mrp: e.target.value })} placeholder="MRP ₹" className="w-20 rounded-lg border px-2 py-1 text-xs" />
                            </div>
                          ) : (
                            <div>
                              <span className="font-extrabold text-slate-900">{inr(r.pricePaise)}</span>
                              {r.mrpPaise > r.pricePaise && <span className="ml-1.5 text-xs text-slate-400 line-through">{inr(r.mrpPaise)}</span>}
                              {off > 0 && <span className="ml-1.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">{off}% OFF</span>}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          {isEditing ? (
                            <input type="number" min={0} value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} className="w-20 rounded-lg border px-2 py-1 text-xs font-bold" />
                          ) : (
                            <span className={`font-bold text-xs px-2.5 py-1 rounded-full ${r.stockOnHand > 5 ? "bg-emerald-50 text-emerald-800" : r.stockOnHand > 0 ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-800"}`}>
                              {r.stockOnHand} in stock
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ${r.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-700"}`}>{r.status}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {isEditing ? (
                            <>
                              <button onClick={() => saveEdit(r)} disabled={busyId === r.listingId} className="rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white">Save</button>
                              <button onClick={() => setEditId(null)} className="rounded-lg border px-2.5 py-1.5 text-xs text-slate-600">Cancel</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => startEdit(r)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">Edit</button>
                              <button onClick={() => toggleStatus(r)} disabled={busyId === r.listingId} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600">
                                {r.status === "ACTIVE" ? "Pause" : "Activate"}
                              </button>
                              <a href={`${WEB_MARKETPLACE_URL}/product/${r.productId}`} target="_blank" rel="noreferrer" className="inline-block rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-bold text-teal-800">View ↗</a>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </SellerShell>
  );
}
