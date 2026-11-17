"use client";
import { useEffect, useState } from "react";
import { clientApi, getSession } from "../../lib/session";

const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

export default function OrdersPage() {
  const [orders, setOrders] = useState<Array<{ id: string; orderNo: string; status: string; grandTotalPaise: number; createdAt: string }>>([]);
  const [busy, setBusy] = useState(true);
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    if (!getSession()) { setAuthed(false); setBusy(false); return; }
    clientApi().myOrders().then(setOrders).catch(() => setOrders([])).finally(() => setBusy(false));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface"><div className="mx-auto max-w-2xl px-4 py-3"><a href="/" className="text-xl font-extrabold text-brand">🛍 ApnaCity</a></div></header>
      <main className="mx-auto max-w-2xl px-4 py-6">
        <h1 className="mb-4 text-xl font-bold">My orders</h1>
        {!authed ? <p className="text-ink-3">Please <a href="/login" className="font-semibold text-brand">log in</a>.</p>
          : busy ? <p className="text-ink-3">Loading…</p>
          : orders.length === 0 ? <p className="text-ink-3">No orders yet.</p>
          : (
            <div className="space-y-2">
              {orders.map((o) => (
                <a key={o.id} href={`/order/${o.id}`} className="flex items-center justify-between rounded-[var(--r-md)] border border-line bg-surface p-4 hover:shadow-[var(--shadow-card)]">
                  <div><div className="font-mono text-sm font-semibold">{o.orderNo}</div><div className="text-xs text-ink-3">{new Date(o.createdAt).toLocaleString("en-IN")} · {o.status}</div></div>
                  <div className="font-bold">{inr(o.grandTotalPaise)}</div>
                </a>
              ))}
            </div>
          )}
      </main>
    </div>
  );
}
