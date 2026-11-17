"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, getSession, getCityId } from "../../lib/session";

const inr = (p: number) => "₹" + Math.round(p / 100).toLocaleString("en-IN");

export default function CheckoutPage() {
  const router = useRouter();
  const [quote, setQuote] = useState<{ itemsTotalPaise: number; deliveryTotalPaise: number; grandTotalPaise: number; shopGroups: unknown[] } | null>(null);
  const [addr, setAddr] = useState({ line1: "", pincode: "", landmark: "" });
  const [busy, setBusy] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [err, setErr] = useState("");
  const [authed, setAuthed] = useState(true);

  useEffect(() => {
    if (!getSession()) { setAuthed(false); setBusy(false); return; }
    clientApi().quote().then((q) => setQuote(q)).catch((e) => setErr((e as Error).message)).finally(() => setBusy(false));
  }, []);

  async function place() {
    setPlacing(true); setErr("");
    try {
      const r = await clientApi().placeOrder({ cityId: getCityId(), addressSnapshot: addr });
      router.push(`/order/${r.orderId}`);
    } catch (e) { setErr((e as Error).message); setPlacing(false); }
  }

  if (!authed) return <Shell><p className="text-ink-3">Please <a href="/login" className="font-semibold text-brand">log in</a> to checkout.</p></Shell>;
  if (busy) return <Shell><p className="text-ink-3">Loading…</p></Shell>;
  if (!quote) return <Shell><p className="text-ink-3">Your cart is empty. <a href="/search" className="font-semibold text-brand">Browse →</a></p></Shell>;

  return (
    <Shell>
      <h1 className="mb-4 text-xl font-bold">Checkout</h1>
      <section className="mb-4 rounded-[var(--r-md)] border border-line bg-surface p-4">
        <h2 className="mb-2 font-semibold">Delivery address</h2>
        <div className="space-y-2">
          <input value={addr.line1} onChange={(e) => setAddr({ ...addr, line1: e.target.value })} placeholder="Address line" className="w-full rounded-lg border border-line px-3 py-2" />
          <div className="flex gap-2">
            <input value={addr.pincode} onChange={(e) => setAddr({ ...addr, pincode: e.target.value })} placeholder="Pincode" className="w-32 rounded-lg border border-line px-3 py-2" />
            <input value={addr.landmark} onChange={(e) => setAddr({ ...addr, landmark: e.target.value })} placeholder="Landmark (optional)" className="flex-1 rounded-lg border border-line px-3 py-2" />
          </div>
        </div>
      </section>
      <section className="rounded-[var(--r-md)] border border-line bg-surface p-4">
        <h2 className="mb-2 font-semibold">Order summary</h2>
        <Row label={`Items (${quote.shopGroups.length} shop group${quote.shopGroups.length > 1 ? "s" : ""})`} value={inr(quote.itemsTotalPaise)} />
        <Row label="Delivery" value={inr(quote.deliveryTotalPaise)} />
        <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-base font-bold"><span>Total</span><span>{inr(quote.grandTotalPaise)}</span></div>
        <div className="mt-2 text-xs text-ink-3">Payment: Cash on delivery (dev — card/UPI via Cashfree later)</div>
        <button onClick={place} disabled={placing || !addr.line1 || !addr.pincode} className="mt-4 w-full rounded-full bg-accent py-3 font-bold text-white disabled:opacity-50">
          {placing ? "Placing order…" : `Place order · ${inr(quote.grandTotalPaise)}`}
        </button>
        {err && <p className="mt-3 rounded bg-warn/10 p-2 text-sm text-warn">{err}</p>}
      </section>
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between py-0.5 text-sm text-ink-2"><span>{label}</span><span>{value}</span></div>;
}
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface"><div className="mx-auto max-w-2xl px-4 py-3"><a href="/" className="text-xl font-extrabold text-brand">🛍 ApnaCity</a></div></header>
      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
    </div>
  );
}
