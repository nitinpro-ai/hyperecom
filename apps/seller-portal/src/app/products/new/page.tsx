"use client";
import { useEffect, useState } from "react";
import { clientApi, getSession } from "../../../lib/session";

export default function NewProduct() {
  const [cats, setCats] = useState<Array<{ id: string; name: string }>>([]);
  const [f, setF] = useState({ shopId: "", categoryId: "", name: "", description: "", gtin: "", sellerSku: "", mrp: "", price: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => { clientApi().categories().then((c) => setCats(c)).catch(() => setCats([])); }, []);

  async function publish() {
    if (!getSession()) { location.href = "/login"; return; }
    setBusy(true); setMsg(""); setDone(false);
    try {
      const api = clientApi();
      // 1) match-or-create the master product (+ a variant)
      const p = await api.createProduct({ categoryId: f.categoryId, name: f.name, description: f.description || undefined, gtin: f.gtin || undefined, variant: { sku: f.sellerSku || undefined } });
      // 2) draft a listing for this shop
      const d = await api.createListingDraft(f.shopId, {
        productId: p.productId,
        variants: [{ variantId: p.variantId, sellerSku: f.sellerSku || `SKU-${Date.now()}`, mrpPaise: Math.round(Number(f.mrp) * 100), pricePaise: Math.round(Number(f.price) * 100) }],
      });
      // 3) publish it
      await api.publishListing(d.listingId, 1);
      setDone(true);
      setMsg(`Published! Product "${f.name}" is now live and searchable. (${p.matched === "GTIN" ? "attached to existing master via GTIN" : "new master created"})`);
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold text-teal-700">Add a product</h1>
      <p className="mt-1 text-sm text-gray-500">Create → list for your shop → publish, in one step.</p>
      <div className="mt-6 space-y-3">
        <input value={f.shopId} onChange={(e) => setF({ ...f, shopId: e.target.value })} placeholder="Your shopId" className="w-full rounded-lg border px-3 py-2.5" />
        <select value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })} className="w-full rounded-lg border px-3 py-2.5">
          <option value="">Select category…</option>
          {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Product name" className="w-full rounded-lg border px-3 py-2.5" />
        <input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Description (optional)" className="w-full rounded-lg border px-3 py-2.5" />
        <input value={f.gtin} onChange={(e) => setF({ ...f, gtin: e.target.value })} placeholder="GTIN/barcode (optional — dedupes across shops)" className="w-full rounded-lg border px-3 py-2.5" />
        <div className="flex gap-2">
          <input value={f.sellerSku} onChange={(e) => setF({ ...f, sellerSku: e.target.value })} placeholder="Your SKU" className="flex-1 rounded-lg border px-3 py-2.5" />
          <input value={f.mrp} onChange={(e) => setF({ ...f, mrp: e.target.value })} placeholder="MRP ₹" inputMode="decimal" className="w-24 rounded-lg border px-3 py-2.5" />
          <input value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="Price ₹" inputMode="decimal" className="w-24 rounded-lg border px-3 py-2.5" />
        </div>
        <button onClick={publish} disabled={busy || !f.shopId || !f.categoryId || !f.name || !f.mrp || !f.price} className="w-full rounded-full bg-amber-500 py-3 font-bold text-white disabled:opacity-50">
          {busy ? "Publishing…" : "Publish product"}
        </button>
      </div>
      {msg && <p className={`mt-4 rounded-lg p-3 text-xs ${done ? "bg-green-50 text-green-800" : "bg-gray-100 text-gray-700"}`}>{msg}</p>}
      <a href="/" className="mt-4 block text-sm text-teal-700">← Dashboard</a>
    </main>
  );
}
