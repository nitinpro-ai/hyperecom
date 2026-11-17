"use client";
import { useEffect, useState } from "react";
import { clientApi, getSession, clearSession } from "../lib/session";

export default function SellerHome() {
  const [me, setMe] = useState<{ name: string; roles: string[] } | null>(null);
  const [shop, setShop] = useState({ name: "", cityId: "" });
  const [shopId, setShopId] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [sellerId, setSellerId] = useState("");

  useEffect(() => {
    if (!getSession()) return;
    clientApi().me().then((u) => setMe({ name: u.name, roles: u.roles.map((r) => r.role.name) })).catch(() => setMe(null));
  }, []);

  async function createShop() {
    setMsg("");
    try {
      const r = await clientApi().createShop({ sellerId, cityId: shop.cityId, name: shop.name });
      setShopId(r.shopId);
      setMsg(`Shop created: ${r.host}`);
    } catch (e) { setMsg(`Error: ${(e as Error).message} (seller must be APPROVED first)`); }
  }

  if (!getSession()) {
    return <Center><a href="/login" className="rounded-full bg-teal-700 px-6 py-3 font-bold text-white">Login to continue</a></Center>;
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-teal-700">🏪 Seller Dashboard</h1>
        <button onClick={() => { clearSession(); location.href = "/login"; }} className="text-sm text-gray-500">Logout</button>
      </div>
      {me && <p className="mt-1 text-sm text-gray-600">Hi {me.name} · roles: {me.roles.join(", ") || "CUSTOMER"}</p>}

      <ol className="mt-6 space-y-4">
        <Step n={1} title="Register & submit KYC">
          <a href="/register" className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white">Register as seller →</a>
        </Step>
        <Step n={2} title="Open your shop (after admin approves KYC)">
          <div className="space-y-2">
            <input value={sellerId} onChange={(e) => setSellerId(e.target.value)} placeholder="Your sellerId (from registration)" className="w-full rounded border px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <input value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} placeholder="Shop name" className="flex-1 rounded border px-3 py-2 text-sm" />
              <input value={shop.cityId} onChange={(e) => setShop({ ...shop, cityId: e.target.value })} placeholder="cityId" className="w-40 rounded border px-3 py-2 text-sm" />
            </div>
            <button onClick={createShop} disabled={!sellerId || !shop.name || !shop.cityId} className="rounded-full bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Create shop</button>
            {shopId && <p className="text-xs text-green-700">Shop {shopId.slice(0, 8)}… created.</p>}
          </div>
        </Step>
        <Step n={3} title="Upload a product">
          <a href="/products/new" className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white">Add product →</a>
        </Step>
      </ol>
      {msg && <p className="mt-4 rounded-lg bg-gray-100 p-3 text-xs text-gray-700">{msg}</p>}
    </main>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-full bg-teal-100 text-sm font-bold text-teal-700">{n}</span><span className="font-semibold">{title}</span></div>
      {children}
    </li>
  );
}
function Center({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-4"><div className="text-5xl">🏪</div><h1 className="text-2xl font-bold text-teal-700">ApnaCity Seller</h1>{children}</main>;
}
