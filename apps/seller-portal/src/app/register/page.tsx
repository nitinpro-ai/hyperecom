"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, getSession } from "../../lib/session";

export default function SellerRegister() {
  const router = useRouter();
  const [f, setF] = useState({ legalName: "", displayName: "", businessType: "PROPRIETORSHIP", pan: "", gstin: "" });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!getSession()) { router.push("/login"); return; }
    setBusy(true); setMsg("");
    try {
      const api = clientApi();
      const r = await api.registerSeller({ legalName: f.legalName, displayName: f.displayName, businessType: f.businessType, pan: f.pan, gstin: f.gstin || undefined });
      await api.submitKyc();
      setMsg(`Registered (seller ${r.sellerId.slice(0, 8)}…) and KYC submitted. An admin must approve before you can open a shop. In dev, approve via: POST /v1/admin/sellers/${r.sellerId}/approve`);
    } catch (e) { setMsg(`Error: ${(e as Error).message}`); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-xl font-bold text-teal-700">Register as a seller</h1>
      <p className="mt-1 text-sm text-gray-500">KYC details (PAN mandatory). GSTIN optional.</p>
      <div className="mt-6 space-y-3">
        <input value={f.legalName} onChange={(e) => setF({ ...f, legalName: e.target.value })} placeholder="Legal name" className="w-full rounded-lg border px-3 py-2.5" />
        <input value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} placeholder="Shop display name" className="w-full rounded-lg border px-3 py-2.5" />
        <select value={f.businessType} onChange={(e) => setF({ ...f, businessType: e.target.value })} className="w-full rounded-lg border px-3 py-2.5">
          {["INDIVIDUAL", "PROPRIETORSHIP", "PARTNERSHIP", "LLP", "PVT_LTD"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <input value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value.toUpperCase() })} placeholder="PAN (ABCDE1234F)" className="w-full rounded-lg border px-3 py-2.5" />
        <input value={f.gstin} onChange={(e) => setF({ ...f, gstin: e.target.value.toUpperCase() })} placeholder="GSTIN (optional)" className="w-full rounded-lg border px-3 py-2.5" />
        <button onClick={submit} disabled={busy || !f.legalName || !f.pan} className="w-full rounded-full bg-teal-700 py-3 font-bold text-white disabled:opacity-50">{busy ? "Submitting…" : "Register & submit KYC"}</button>
      </div>
      {msg && <p className="mt-4 rounded-lg bg-gray-100 p-3 text-xs text-gray-700">{msg}</p>}
      <a href="/" className="mt-4 block text-sm text-teal-700">← Dashboard</a>
    </main>
  );
}
