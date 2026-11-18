"use client";
import { useEffect, useState } from "react";
import { clientApi, clearSession, getSession, inr, setSession, WEB_MARKETPLACE_URL } from "../lib/session";
import { SellerShell } from "../components/seller-shell";

type Overview = Awaited<ReturnType<ReturnType<typeof clientApi>["sellerMe"]>>;
type SellerOrderRow = Awaited<ReturnType<ReturnType<typeof clientApi>["sellerOrders"]>>[number];
type ListingRow = Awaited<ReturnType<ReturnType<typeof clientApi>["sellerListings"]>>[number];

export default function SellerHome() {
  const [hasAuth, setHasAuth] = useState<boolean | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [orders, setOrders] = useState<SellerOrderRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string>("");
  const [orderTab, setOrderTab] = useState<"ALL" | "ACTION" | "ACTIVE" | "DONE">("ALL");
  const [showNewShop, setShowNewShop] = useState(false);
  const [newShop, setNewShop] = useState({ name: "", cityId: "", description: "" });
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function refresh(shopFilter?: string) {
    const sess = getSession();
    if (!sess) {
      setHasAuth(false);
      return;
    }
    setHasAuth(true);
    const api = clientApi();
    try {
      const [ov, ord, lst] = await Promise.all([
        api.sellerMe(),
        api.sellerOrders(shopFilter || undefined),
        api.sellerListings(shopFilter || undefined),
      ]);
      setOverview(ov);
      setOrders(ord);
      setListings(lst);
      if (ov.cities[0]) setNewShop((p) => ({ ...p, cityId: p.cityId || ov.cities[0]!.id }));
    } catch (err) {
      if (/401|token|missing bearer/i.test((err as Error).message || "") || !getSession()) {
        clearSession();
        setHasAuth(false);
      }
    }
  }

  useEffect(() => {
    void refresh(selectedShopId || undefined);
  }, [selectedShopId]);

  async function handleDevApprove() {
    setBusy(true); setMsg("");
    try {
      const r = await clientApi().devApproveSeller();
      if (r.tokens) setSession(r.tokens);
      setMsg("⚡ KYC Approved & SELLER_OWNER role activated!");
      await refresh(selectedShopId || undefined);
    } catch (e) {
      setMsg(`Error: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateShop(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const r = await clientApi().createShop({
        sellerId: overview?.seller?.id,
        cityId: newShop.cityId,
        name: newShop.name.trim(),
        description: newShop.description.trim() || undefined,
      });
      setShowNewShop(false);
      setNewShop((p) => ({ ...p, name: "", description: "" }));
      setMsg(`🎉 Storefront "${r.host}" created and activated!`);
      await refresh(selectedShopId || undefined);
    } catch (e) {
      setMsg(`Could not create shop: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleOrderAction(orderId: string, action: "accept" | "reject" | "preparing" | "ready" | "dispatch") {
    setBusy(true); setMsg("");
    try {
      const r = await clientApi().sellerOrderAction(orderId, action, action === "reject" ? "Out of stock" : undefined);
      setMsg(`Order updated → ${r.status}`);
      await refresh(selectedShopId || undefined);
    } catch (e) {
      setMsg(`Order action failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  if (hasAuth === false) {
    return (
      <div className="min-h-screen hero-sidebar text-white flex flex-col justify-between p-6 sm:p-12">
        <header className="mx-auto w-full max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-xl font-black text-slate-950 shadow-lg">A</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight">ApnaCity</span>
                <span className="rounded-md bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-300">Seller Studio</span>
              </div>
              <p className="text-xs text-teal-200/80">अपनी दुकान, ऑनलाइन · Hyperlocal Merchant Platform</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a href="/login" className="rounded-xl border border-white/20 bg-white/10 hover:bg-white/15 px-4 py-2 text-xs font-bold text-white transition">
              Sign In
            </a>
            <a href="/register" className="rounded-xl bg-amber-400 hover:bg-amber-300 px-4 py-2 text-xs font-extrabold text-slate-950 shadow-md transition">
              Register as Seller →
            </a>
          </div>
        </header>

        <main className="mx-auto max-w-5xl text-center my-12 space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/15 px-4 py-1.5 text-xs font-bold text-teal-200">
            🚀 Zero-Commission Local Onboarding · Instant Custom Subdomain
          </span>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight">
            Turn Your Local Shop Into a <span className="text-amber-300">City-Wide Digital Brand</span>
          </h1>
          <p className="mx-auto max-w-2xl text-sm sm:text-base text-teal-100/80 leading-relaxed">
            Register in 3 steps, get your own storefront domain (<code className="text-amber-200">your-shop.apnacity.com</code>), list products via barcode, and fulfill hyperlocal orders in real time.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a href="/register" className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 px-7 py-3.5 text-sm font-black text-slate-950 shadow-xl transition">
              ✨ Start 3-Step Seller Registration →
            </a>
            <a href="/login" className="rounded-2xl border border-white/20 bg-white/10 hover:bg-white/15 px-7 py-3.5 text-sm font-bold text-white transition">
              Sign In / Demo Seller Login
            </a>
          </div>

          <div className="grid sm:grid-cols-3 gap-4 pt-8 text-left">
            {[
              { step: "01", title: "Account & PAN KYC", desc: "Sign up with email & mobile, verify PAN/GSTIN, and unlock SELLER_OWNER access." },
              { step: "02", title: "Open City Storefront", desc: "Pick your city and shop name — get an instant subdomain and inventory floor." },
              { step: "03", title: "List & Fulfill Orders", desc: "Publish products with live stock & MRP discount badges; accept & dispatch orders." },
            ].map((c) => (
              <div key={c.step} className="rounded-2xl border border-white/12 bg-white/6 p-5 backdrop-blur-sm">
                <span className="text-xs font-black text-amber-300">STEP {c.step}</span>
                <div className="mt-1 text-base font-bold text-white">{c.title}</div>
                <p className="mt-1 text-xs text-teal-100/75 leading-relaxed">{c.desc}</p>
              </div>
            ))}
          </div>
        </main>

        <footer className="mx-auto w-full max-w-6xl pt-6 border-t border-white/10 flex items-center justify-between text-xs text-teal-200/70">
          <span>ApnaCity Seller Studio</span>
          <a href={WEB_MARKETPLACE_URL} target="_blank" rel="noreferrer" className="text-amber-300 font-semibold hover:underline">
            Customer Marketplace ↗
          </a>
        </footer>
      </div>
    );
  }

  const activeShop = overview?.shops.find((s) => s.id === selectedShopId) ?? overview?.shops[0] ?? null;
  const filteredOrders = orders.filter((o) => {
    if (orderTab === "ACTION") return ["NEW", "ACCEPTED"].includes(o.status);
    if (orderTab === "ACTIVE") return ["PREPARING", "READY", "DISPATCHED", "OUT_FOR_DELIVERY"].includes(o.status);
    if (orderTab === "DONE") return ["DELIVERED", "CLOSED", "CANCELLED", "REJECTED"].includes(o.status);
    return true;
  });

  return (
    <SellerShell
      active="dashboard"
      userName={overview?.user?.name}
      sellerName={overview?.seller?.displayName}
      kycStatus={overview?.seller?.status}
      activeShop={activeShop}
      pendingOrdersCount={overview?.stats.pendingOrders ?? 0}
      onDevApprove={handleDevApprove}
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
              🏪 Merchant Command Center
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">
              {overview?.seller ? overview.seller.displayName : `Welcome, ${overview?.user?.name || "Partner"}`}
            </h1>
            <p className="text-sm text-slate-500">
              {activeShop
                ? `Managing ${activeShop.name} (${activeShop.cityName}) · ${activeShop.host}`
                : "Complete your seller KYC & storefront setup to start selling across your city."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {overview && overview.shops.length > 0 && (
              <>
                <select value={selectedShopId} onChange={(e) => setSelectedShopId(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-800">
                  <option value="">All My Shops ({overview.shops.length})</option>
                  {overview.shops.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} · {s.cityName}</option>
                  ))}
                </select>
                <button type="button" onClick={() => setShowNewShop((v) => !v)} className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700">
                  + New Branch Shop
                </button>
              </>
            )}
            <a href="/products/new" className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-sm transition">
              + Add Product
            </a>
          </div>
        </div>

        {msg && (
          <div className="rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-xs font-semibold text-teal-900">
            {msg}
          </div>
        )}
        {overview && (!overview.seller || overview.seller.status !== "APPROVED" || overview.shops.length === 0) && (
          <div className="rounded-3xl border border-amber-300 bg-gradient-to-r from-amber-50 via-orange-50/70 to-teal-50/50 p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="rounded-full bg-amber-400/30 px-2.5 py-0.5 text-[11px] font-extrabold uppercase text-amber-900">
                  Action Required · Setup Progress
                </span>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {!overview.seller
                    ? "Step 2: Register Your Business & PAN KYC"
                    : overview.seller.status !== "APPROVED"
                      ? `Your Seller KYC is ${overview.seller.status} — Approve to Open Your Shop`
                      : "Step 3: Open Your First City Storefront"}
                </h2>
                <p className="text-xs text-slate-600 max-w-xl">
                  {!overview.seller
                    ? "Submit your legal business name and PAN in our guided wizard to unlock storefront creation."
                    : overview.seller.status !== "APPROVED"
                      ? "In the dev environment, you can approve your KYC with 1 click below or via the Admin Portal."
                      : "Your seller KYC is approved! Pick your city and launch your shop subdomain now."}
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                {overview.seller && overview.seller.status !== "APPROVED" && (
                  <button onClick={handleDevApprove} disabled={busy} className="rounded-xl bg-amber-500 hover:bg-amber-400 px-5 py-2.5 text-xs font-extrabold text-slate-950 shadow-sm">
                    ⚡ Instant Approve KYC (Dev)
                  </button>
                )}
                <a href="/register" className="rounded-xl bg-teal-700 hover:bg-teal-800 px-5 py-2.5 text-xs font-bold text-white shadow-sm">
                  Open Onboarding Wizard →
                </a>
              </div>
            </div>
          </div>
        )}

        {showNewShop && (
          <form onSubmit={handleCreateShop} className="rounded-3xl border border-teal-200 bg-white p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-extrabold text-slate-900">Launch a New Storefront</h3>
              <button type="button" onClick={() => setShowNewShop(false)} className="text-xs text-slate-400 hover:text-slate-700">✕ Close</button>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <input required value={newShop.name} onChange={(e) => setNewShop({ ...newShop, name: e.target.value })} placeholder="Shop name (e.g. Bagga Electronics)" className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm" />
              <select required value={newShop.cityId} onChange={(e) => setNewShop({ ...newShop, cityId: e.target.value })} className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm bg-white">
                {overview?.cities.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.stateName})</option>)}
              </select>
              <input value={newShop.description} onChange={(e) => setNewShop({ ...newShop, description: e.target.value })} placeholder="Short description (optional)" className="rounded-xl border border-slate-300 px-3.5 py-2 text-sm" />
            </div>
            <button type="submit" disabled={busy || !newShop.name} className="rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-bold text-white">
              {busy ? "Creating…" : "Create Active Storefront"}
            </button>
          </form>
        )}
        {/* 4 Executive KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Gross Sales Revenue", val: inr(overview?.stats.revenuePaise ?? 0), sub: "Across fulfilled & active orders", tone: "from-emerald-500/10 to-teal-500/5 border-emerald-200", icon: "💰" },
            { label: "Active Catalogue", val: `${overview?.stats.activeListings ?? 0} / ${overview?.stats.totalListings ?? 0}`, sub: "Live products in city search", tone: "from-teal-500/10 to-cyan-500/5 border-teal-200", icon: "📦" },
            { label: "Orders Action Needed", val: String(overview?.stats.pendingOrders ?? 0), sub: "Accept, prepare & dispatch", tone: "from-amber-500/15 to-orange-500/5 border-amber-300", icon: "🔔" },
            { label: "Total Orders", val: String(overview?.stats.totalOrders ?? 0), sub: `${overview?.shops.length ?? 0} active storefront(s)`, tone: "from-slate-500/10 to-slate-500/5 border-slate-200", icon: "🧾" },
          ].map((k) => (
            <div key={k.label} className={`rounded-3xl border bg-gradient-to-br ${k.tone} bg-white p-5 shadow-sm`}>
              <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>{k.label}</span>
                <span className="text-lg">{k.icon}</span>
              </div>
              <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900">{k.val}</div>
              <div className="mt-1 text-[11px] font-medium text-slate-500">{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Storefront Cards Row */}
        {overview && overview.shops.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {overview.shops.map((s) => (
              <div key={s.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800">{s.status}</span>
                    <span className="text-xs font-medium text-slate-500">📍 {s.cityName}</span>
                  </div>
                  <div className="mt-2 text-base font-extrabold text-slate-900">{s.name}</div>
                  <div className="text-xs font-mono text-teal-700 truncate">{s.host}</div>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-600"><b>{s.listingCount}</b> products · <b>{s.orderCount}</b> orders</span>
                  <a href={`${WEB_MARKETPLACE_URL}/search?shopId=${encodeURIComponent(s.id)}`} target="_blank" rel="noreferrer" className="font-bold text-teal-700 hover:underline">
                    Storefront ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">📋 Live Order Fulfillment Inbox</h2>
              <p className="text-xs text-slate-500">Accept incoming city orders, mark preparation, and dispatch for local delivery.</p>
            </div>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-xs font-bold">
              {(["ALL", "ACTION", "ACTIVE", "DONE"] as const).map((t) => (
                <button key={t} type="button" onClick={() => setOrderTab(t)} className={`rounded-lg px-3 py-1.5 transition ${orderTab === t ? "bg-white text-teal-800 shadow-sm" : "text-slate-600"}`}>
                  {t === "ACTION" ? "Action Needed" : t === "ACTIVE" ? "In Progress" : t === "DONE" ? "Completed" : "All Orders"}
                </button>
              ))}
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-xs text-slate-500">
              No orders in this filter yet. When customers place orders on the marketplace, they appear here in real time.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.slice(0, 12).map((o) => (
                <div key={o.id} className="rounded-2xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-teal-300 transition">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-extrabold text-slate-900">#{o.sellerOrderNo || o.orderNo}</span>
                      <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-[11px] font-bold text-teal-800">{o.status}</span>
                      <span className="text-xs text-slate-500">🏪 {o.shopName}</span>
                    </div>
                    <div className="text-xs text-slate-700">
                      {o.items.map((it) => `${it.quantity}× ${it.name}`).join(" · ") || "Order items"}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Total: <b className="text-slate-800">{inr(o.itemsTotalPaise)}</b> · Placed {new Date(o.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {o.status === "NEW" && (
                      <>
                        <button onClick={() => handleOrderAction(o.id, "accept")} disabled={busy} className="rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white">Accept Order</button>
                        <button onClick={() => handleOrderAction(o.id, "reject")} disabled={busy} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Reject</button>
                      </>
                    )}
                    {o.status === "ACCEPTED" && (
                      <button onClick={() => handleOrderAction(o.id, "preparing")} disabled={busy} className="rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950">Start Preparing</button>
                    )}
                    {o.status === "PREPARING" && (
                      <button onClick={() => handleOrderAction(o.id, "ready")} disabled={busy} className="rounded-xl bg-teal-700 px-3.5 py-2 text-xs font-bold text-white">Mark Ready for Pickup</button>
                    )}
                    {o.status === "READY" && (
                      <button onClick={() => handleOrderAction(o.id, "dispatch")} disabled={busy} className="rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white">Dispatch Order 🚚</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">📦 Recent Catalogue Listings ({listings.length})</h2>
              <p className="text-xs text-slate-500">Quick view of your listed products and current shelf inventory.</p>
            </div>
            <a href="/products" className="rounded-xl border border-slate-300 px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              Manage All Products →
            </a>
          </div>
          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-6 text-center text-xs text-slate-500">
              No products listed yet. Click <b>+ Add Product</b> to publish your first item.
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {listings.slice(0, 6).map((l) => (
                <div key={l.listingId} className="rounded-2xl border border-slate-200 p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-slate-900 truncate">{l.title}</div>
                    <div className="text-xs text-slate-500 truncate">{l.categoryName} · {l.shopName}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-extrabold text-sm text-teal-800">{inr(l.pricePaise)}</span>
                      <span className="text-[11px] text-slate-400 line-through">{inr(l.mrpPaise)}</span>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${l.stockOnHand > 0 ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
                    {l.stockOnHand} in stock
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </SellerShell>
  );
}

