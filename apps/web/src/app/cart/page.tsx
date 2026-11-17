"use client";
import { useEffect, useState } from "react";
import { clientApi, getSession } from "../../lib/session";

interface CartItem { id: string; listingVariantId: string; shopId: string; quantity: number; addedPricePaise: number; currentPricePaise: number | null; drift: boolean; unavailable: boolean }
const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [drift, setDrift] = useState(false);
  const [busy, setBusy] = useState(true);
  const [authed, setAuthed] = useState(true);

  async function load() {
    if (!getSession()) { setAuthed(false); setBusy(false); return; }
    setBusy(true);
    try {
      const c = await clientApi().getCart();
      setItems(c.items); setTotal(c.itemsTotalPaise); setDrift(c.hasDrift);
    } finally { setBusy(false); }
  }
  useEffect(() => { load(); }, []);

  async function setQty(id: string, q: number) { await clientApi().updateCartItem(id, q); load(); }
  async function remove(id: string) { await clientApi().removeCartItem(id); load(); }

  if (!authed) return <Shell><p className="text-ink-3">Please <a href="/login" className="font-semibold text-brand">log in</a> to view your cart.</p></Shell>;
  if (busy) return <Shell><p className="text-ink-3">Loading cart…</p></Shell>;

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-bold">Your cart</h1>
      {items.length === 0 ? (
        <p className="text-ink-3">Your cart is empty. <a href="/search" className="font-semibold text-brand">Browse products →</a></p>
      ) : (
        <>
          {drift && <p className="mb-3 rounded-lg bg-warn/10 p-3 text-sm text-warn">Some prices or availability changed since you added these items.</p>}
          <div className="space-y-2">
            {items.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-[var(--r-md)] border border-line bg-surface p-3">
                <div className="img-ph h-14 w-14 rounded" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">Item {i.listingVariantId.slice(0, 8)}</div>
                  <div className="text-xs text-ink-3">{inr(i.currentPricePaise ?? i.addedPricePaise)} each{i.unavailable && " · unavailable"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setQty(i.id, i.quantity - 1)} className="h-7 w-7 rounded border border-line">−</button>
                  <span className="w-6 text-center text-sm">{i.quantity}</span>
                  <button onClick={() => setQty(i.id, i.quantity + 1)} className="h-7 w-7 rounded border border-line">+</button>
                </div>
                <button onClick={() => remove(i.id)} className="text-xs text-ink-3 hover:text-warn">Remove</button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-between rounded-[var(--r-md)] border border-line bg-surface p-4">
            <div><div className="text-xs text-ink-3">Subtotal</div><div className="text-lg font-bold">{inr(total)}</div></div>
            <a href="/checkout" className="rounded-full bg-accent px-6 py-3 font-bold text-white">Proceed to checkout</a>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface"><div className="mx-auto max-w-3xl px-4 py-3"><a href="/" className="text-xl font-extrabold text-brand">🛍 ApnaCity</a></div></header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
