"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, setSession } from "../../lib/session";

export default function SellerLogin() {
  const router = useRouter();
  const [phone, setPhone] = useState("+91");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const api = clientApi();

  async function send() {
    setBusy(true); setMsg("");
    try { await api.requestOtp(phone); setStage("otp"); setMsg("OTP sent. Dev: read it from `kubectl -n apnacity logs deploy/api | grep OTP`."); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }
  async function verify() {
    setBusy(true); setMsg("");
    try { setSession(await api.verifyOtp(phone, otp, name || undefined)); router.push("/"); }
    catch (e) { setMsg((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="text-2xl font-bold text-teal-700">ApnaCity Seller</h1>
      <p className="mt-1 text-sm text-gray-500">अपनी दुकान ऑनलाइन चलाएँ · Log in to manage your shop</p>
      {stage === "phone" ? (
        <div className="mt-6 space-y-3">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" className="w-full rounded-lg border px-3 py-2.5" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (new users)" className="w-full rounded-lg border px-3 py-2.5" />
          <button onClick={send} disabled={busy} className="w-full rounded-full bg-teal-700 py-3 font-bold text-white disabled:opacity-50">{busy ? "Sending…" : "Send OTP"}</button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" className="w-full rounded-lg border px-3 py-2.5 text-center tracking-widest" />
          <button onClick={verify} disabled={busy} className="w-full rounded-full bg-amber-500 py-3 font-bold text-white disabled:opacity-50">{busy ? "Verifying…" : "Verify & Login"}</button>
        </div>
      )}
      {msg && <p className="mt-4 rounded-lg bg-gray-100 p-3 text-xs text-gray-600">{msg}</p>}
    </main>
  );
}
