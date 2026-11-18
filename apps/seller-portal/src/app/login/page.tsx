"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, setSession, WEB_MARKETPLACE_URL } from "../../lib/session";

export default function SellerLogin() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "otp">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("+91");
  const [otp, setOtp] = useState("");
  const [otpStage, setOtpStage] = useState<"phone" | "verify">("phone");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const api = clientApi();

  async function doLogin(e?: React.FormEvent, override?: { email: string; password: string }) {
    if (e) e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const creds = override ?? { email: email.trim(), password };
      const s = await api.loginEmail(creds);
      setSession(s);
      router.push("/");
    } catch (err) {
      const m = (err as Error).message || "";
      setMsg(/401|NO_USER|WRONG_PASSWORD|NO_PASSWORD/.test(m) ? "Invalid email or password. New here? Switch to '✨ New Seller'." : m);
    } finally { setBusy(false); }
  }

  async function doSignup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg("");
    try {
      const rawPhone = phone.trim().replace(/\s+/g, "");
      const cleanPhone = rawPhone.startsWith("+") ? rawPhone : `+91${rawPhone}`;
      const s = await api.register({ email: email.trim(), phone: cleanPhone, password, name: name.trim() || undefined });
      setSession(s);
      router.push("/register");
    } catch (err) {
      const m = (err as Error).message || "";
      setMsg(/409|TAKEN|already/i.test(m) ? "That email or mobile number is already registered. Please Sign In instead." : `Could not register: ${m}`);
    } finally { setBusy(false); }
  }

  async function sendOtp() {
    setBusy(true); setMsg("");
    try {
      await api.requestOtp(phone.trim());
      setOtpStage("verify");
      setMsg("OTP sent! (In dev cluster: check API pod logs for the 6-digit code, or use Email Sign-Up / Sign In.)");
    } catch (err) { setMsg((err as Error).message); } finally { setBusy(false); }
  }

  async function verifyOtp() {
    setBusy(true); setMsg("");
    try {
      const s = await api.verifyOtp(phone.trim(), otp.trim(), name.trim() || undefined);
      setSession(s);
      router.push("/");
    } catch (err) { setMsg((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-12 studio-mesh">
      <div className="hero-sidebar text-white lg:col-span-5 p-8 sm:p-12 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-teal-400 to-emerald-600 text-xl font-black text-slate-950 shadow-lg">A</span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tight">ApnaCity</span>
                <span className="rounded-md bg-amber-400/20 border border-amber-400/40 px-2 py-0.5 text-[11px] font-bold uppercase text-amber-300">Seller Studio</span>
              </div>
              <p className="text-xs text-teal-200/80">Hyperlocal Multi-Vendor Merchant Console</p>
            </div>
          </div>

          <h1 className="mt-10 text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight">
            अपनी दुकान को शहर के हर घर तक पहुँचाएँ।
          </h1>
          <p className="mt-3 text-sm sm:text-base text-teal-100/80 leading-relaxed">
            Launch your verified digital storefront in minutes. Upload products once — appear across your custom shop domain, city search, and price-comparison tables.
          </p>

          <div className="mt-8 space-y-3.5 text-sm">
            {[
              { icon: "⚡", title: "3-Step Instant Onboarding", desc: "Create account → PAN/GST KYC → open your city storefront" },
              { icon: "🌐", title: "Automatic Storefront Domain", desc: "Every shop gets its own subdomain (e.g. bagga-cloth.apnacity.com)" },
              { icon: "📦", title: "Smart GTIN Catalog & Live Stock", desc: "1-click barcode match, real-time inventory & order fulfillment" },
            ].map((f) => (
              <div key={f.title} className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-sm">
                <span className="text-xl">{f.icon}</span>
                <div>
                  <div className="font-bold text-white">{f.title}</div>
                  <div className="text-xs text-teal-100/75 mt-0.5">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex items-center justify-between text-xs text-teal-200/70">
          <span>ApnaCity Hyperlocal Commerce</span>
          <a href={WEB_MARKETPLACE_URL} target="_blank" rel="noreferrer" className="text-amber-300 font-semibold hover:underline">
            Browse Marketplace ↗
          </a>
        </div>
      </div>
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-7 sm:p-9 shadow-xl shadow-slate-900/5">
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-slate-100 p-1 text-xs font-bold">
            <button type="button" onClick={() => { setMode("login"); setMsg(""); }} className={`rounded-xl py-2.5 transition ${mode === "login" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              Sign In
            </button>
            <button type="button" onClick={() => { setMode("signup"); setMsg(""); }} className={`rounded-xl py-2.5 transition ${mode === "signup" ? "bg-teal-700 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              ✨ New Seller
            </button>
            <button type="button" onClick={() => { setMode("otp"); setMsg(""); }} className={`rounded-xl py-2.5 transition ${mode === "otp" ? "bg-white text-teal-800 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
              Phone OTP
            </button>
          </div>

          {mode === "login" && (
            <form onSubmit={doLogin} className="mt-6 space-y-4">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Welcome back, Partner</h2>
                <p className="text-xs text-slate-500 mt-0.5">Sign in with your registered merchant email and password.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourshop.com" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600" />
              </div>
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-teal-700 hover:bg-teal-800 py-3 text-sm font-bold text-white shadow-md shadow-teal-700/20 disabled:opacity-50 transition">
                {busy ? "Signing in…" : "Sign In to Seller Studio →"}
              </button>

              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => doLogin(undefined, { email: "demo_seller@apnacity.dev", password: "demo12345" })}
                  className="w-full rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100/80 py-2.5 text-xs font-bold text-amber-900 transition flex items-center justify-center gap-2"
                >
                  <span>⚡ 1-Click Demo Seller Login</span>
                  <span className="font-normal text-amber-700">(demo_seller@apnacity.dev)</span>
                </button>
                <p className="text-center text-xs text-slate-500">
                  Don&apos;t have a seller account yet?{" "}
                  <button type="button" onClick={() => setMode("signup")} className="font-bold text-teal-700 hover:underline">
                    Register as a New Seller →
                  </button>
                </p>
              </div>
            </form>
          )}
          {mode === "signup" && (
            <form onSubmit={doSignup} className="mt-6 space-y-3.5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Create Your Seller Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">Step 1 of 3 — Create your login, then complete KYC &amp; launch your shop.</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name / Owner Name</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rajesh Bagga" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Business Email Address</label>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@myshop.in" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (WhatsApp / Order Alerts)</label>
                <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+919876543210" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Create Password (min 8 characters)</label>
                <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600" />
              </div>
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 py-3 text-sm font-bold text-white shadow-md shadow-teal-700/20 disabled:opacity-50 transition">
                {busy ? "Creating Seller Account…" : "Create Account & Continue to KYC →"}
              </button>
            </form>
          )}

          {mode === "otp" && (
            <div className="mt-6 space-y-3.5">
              <div>
                <h2 className="text-xl font-extrabold text-slate-900">Sign In via Mobile OTP</h2>
                <p className="text-xs text-slate-500 mt-0.5">Instant passwordless login or signup using your mobile number.</p>
              </div>
              {otpStage === "phone" ? (
                <>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91XXXXXXXXXX" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600" />
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (if first time)" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-teal-600" />
                  <button type="button" onClick={sendOtp} disabled={busy} className="w-full rounded-xl bg-teal-700 py-3 text-sm font-bold text-white disabled:opacity-50">
                    {busy ? "Sending OTP…" : "Send 6-Digit OTP"}
                  </button>
                </>
              ) : (
                <>
                  <input value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="Enter 6-digit OTP" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-center text-lg font-bold tracking-widest outline-none focus:border-teal-600" />
                  <button type="button" onClick={verifyOtp} disabled={busy} className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 disabled:opacity-50">
                    {busy ? "Verifying…" : "Verify & Enter Studio →"}
                  </button>
                </>
              )}
            </div>
          )}

          {msg && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-800">
              {msg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

