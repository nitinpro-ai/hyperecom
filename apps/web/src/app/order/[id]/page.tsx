"use client";
import { use, useEffect, useState } from "react";
import { clientApi, getSession } from "../../../lib/session";

const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

export default function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [order, setOrder] = useState<Awaited<ReturnType<ReturnType<typeof clientApi>["orderDetail"]>> | null>(null);
  const [busy, setBusy] = useState(true);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    if (!getSession()) { setAuthed(false); setBusy(false); return; }
    clientApi().orderDetail(id).then(setOrder).catch(() => setOrder(null)).finally(() => setBusy(false));
  }, [id]);

  if (!authed) return <Shell><p className="text-ink-3">Please <a href="/login" className="font-semibold text-brand">log in</a>.</p></Shell>;
  if (busy) return <Shell><p className="text-ink-3">Loading…</p></Shell>;
  if (!order) return <Shell><p className="text-ink-3">Order not found.</p></Shell>;

  return (
    <Shell>
      <div className="rounded-[var(--r-md)] border border-ok/40 bg-ok/5 p-5 text-center">
        <div className="text-3xl">✓</div>
        <h1 className="mt-1 text-xl font-bold text-ok">Order placed!</h1>
        <p className="mt-1 text-sm text-ink-2">Order <span className="font-mono font-semibold">{order.orderNo}</span> · {order.status}</p>
      </div>
      <section className="mt-4 rounded-[var(--r-md)] border border-line bg-surface p-4">
        <h2 className="mb-2 font-semibold">Items</h2>
        {order.items.map((it, i) => (
          <div key={i} className="flex items-center justify-between py-1 text-sm">
            <span>{it.nameSnapshot} × {it.quantity}</span><span className="font-medium">{inr(it.lineTotalPaise)}</span>
          </div>
        ))}
        <div className="mt-2 flex justify-between border-t border-line pt-2 font-bold"><span>Total</span><span>{inr(order.grandTotalPaise)}</span></div>
        <div className="mt-2 text-xs text-ink-3">{order.sellerOrders.length} shop order(s) — each fulfilled independently.</div>
      </section>
      <div className="mt-4 flex gap-2">
        <a href="/orders" className="rounded-full border border-line px-4 py-2 text-sm font-semibold">My orders</a>
        <a href="/" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white">Keep shopping</a>
      </div>
    </Shell>
  );
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface"><div className="mx-auto max-w-2xl px-4 py-3"><a href="/" className="text-xl font-extrabold text-brand">🛍 ApnaCity</a></div></header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
