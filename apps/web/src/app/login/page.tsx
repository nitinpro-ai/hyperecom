"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, setSession } from "../../lib/session";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("+91");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"phone" | "otp">("phone");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const api = clientApi();

  async function requestOtp() {
    setBusy(true); setMsg("");
    try {
      await api.requestOtp(phone);
      setStage("otp");
      setMsg("OTP sent. In dev there is no SMS — read it from the API log: kubectl -n apnacity logs deploy/api | grep OTP");
    } catch (e) { setMsg(`Failed: ${(e as Error).message}`); } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setMsg("");
    try {
      const s = await api.verifyOtp(phone, otp, name || undefined);
      setSession(s);
      router.push("/");
    } catch (e) { setMsg(`Invalid OTP: ${(e as Error).message}`); } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <a href="/" className="text-2xl font-extrabold text-brand">🛍 ApnaCity</a>
      <h1 className="mt-6 text-xl font-bold">Login / Sign up</h1>
      <p className="mt-1 text-sm text-ink-3">Enter your phone to get a one-time code.</p>

      {stage === "phone" ? (
        <div className="mt-6 space-y-3">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX"
            className="w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand" />
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (new users)"
            className="w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand" />
          <button onClick={requestOtp} disabled={busy} className="w-full rounded-full bg-brand py-3 font-bold text-white disabled:opacity-50">
            {busy ? "Sending…" : "Send OTP"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="6-digit OTP" inputMode="numeric"
            className="w-full rounded-lg border border-line px-3 py-2.5 text-center text-lg tracking-widest outline-none focus:border-brand" />
          <button onClick={verify} disabled={busy} className="w-full rounded-full bg-accent py-3 font-bold text-white disabled:opacity-50">
            {busy ? "Verifying…" : "Verify & Login"}
          </button>
          <button onClick={() => setStage("phone")} className="w-full text-sm text-ink-3">← change phone</button>
        </div>
      )}
      {msg && <p className="mt-4 rounded-lg bg-brand-tint p-3 text-xs text-ink-2">{msg}</p>}
    </div>
  );
}
