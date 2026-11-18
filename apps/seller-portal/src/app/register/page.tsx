"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, clearSession, getSession, setSession } from "../../lib/session";
import { SellerShell } from "../../components/seller-shell";

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function generateSamplePan(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pickL = (n: number) => Array.from({ length: n }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  const pickD = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");
  return `${pickL(5)}${pickD(4)}${pickL(1)}`;
}

export default function SellerRegister() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [showPw, setShowPw] = useState(false);
  const [acct, setAcct] = useState({ name: "", email: "", phone: "+91", password: "" });
  const [kyc, setKyc] = useState({
    legalName: "",
    displayName: "",
    businessType: "PROPRIETORSHIP",
    pan: "",
    gstin: "",
    autoApproveDev: true,
  });
  const [shop, setShop] = useState({ name: "", cityId: "", description: "" });
  const [cities, setCities] = useState<Array<{ id: string; name: string; stateName: string }>>([]);
  const [sellerInfo, setSellerInfo] = useState<{ id: string; status: string; displayName: string } | null>(null);
  const [existingShopsCount, setExistingShopsCount] = useState(0);
  const [userName, setUserName] = useState<string>("");
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refreshState() {
    const s = getSession();
    if (!s) {
      setStep(1);
      clientApi().cities().then((c) => {
        setCities(c);
        if (c[0]) setShop((prev) => ({ ...prev, cityId: prev.cityId || c[0]!.id }));
      }).catch(() => {});
      return;
    }
    setUserName(s.user.name);
    try {
      const ov = await clientApi().sellerMe();
      const latest = getSession();
      if (latest?.user?.name) setUserName(latest.user.name);
      setCities(ov.cities);
      if (ov.cities[0]) setShop((prev) => ({ ...prev, cityId: prev.cityId || ov.cities[0]!.id }));
      if (ov.seller) {
        setSellerInfo({ id: ov.seller.id, status: ov.seller.status, displayName: ov.seller.displayName });
        setExistingShopsCount(ov.shops.length);
        setShop((prev) => ({ ...prev, name: prev.name || ov.seller!.displayName }));
        setStep(3);
      } else {
        setStep(2);
      }
    } catch (err) {
      const m = (err as Error).message || "";
      if (/401|token|missing bearer/i.test(m) || !getSession()) {
        clearSession();
        setUserName("");
        setSellerInfo(null);
        setStep(1);
        setMsg({ type: "err", text: "Your previous login session expired. Please create your account or sign in below (Step 1) to continue." });
      } else {
        setStep(2);
      }
    }
  }

  useEffect(() => {
    void refreshState();
  }, []);

  async function handleStep1Account(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const rawPhone = acct.phone.trim().replace(/\s+/g, "");
      const cleanPhone = rawPhone.startsWith("+") ? rawPhone : `+91${rawPhone}`;
      const tokens = await clientApi().register({
        email: acct.email.trim(),
        phone: cleanPhone,
        password: acct.password,
        name: acct.name.trim() || undefined,
      });
      setSession(tokens);
      setUserName(tokens.user.name);
      setKyc((prev) => ({ ...prev, legalName: prev.legalName || `${acct.name.trim()} Enterprises` }));
      setMsg({ type: "ok", text: "Account created! Now complete Step 2 (Business & KYC details)." });
      await refreshState();
      setStep(2);
    } catch (err) {
      const m = (err as Error).message || "";
      if (/409|TAKEN|already/i.test(m)) {
        try {
          const tokens = await clientApi().loginEmail({ email: acct.email.trim(), password: acct.password });
          setSession(tokens);
          setUserName(tokens.user.name);
          setKyc((prev) => ({ ...prev, legalName: prev.legalName || `${tokens.user.name} Enterprises` }));
          setMsg({ type: "ok", text: "Signed in to your existing account! Now complete Step 2 (Business & KYC)." });
          await refreshState();
          return;
        } catch {
          setMsg({
            type: "err",
            text: "That email or mobile is already registered with a different password. Please Sign In or use a new mobile number.",
          });
          return;
        }
      }
      setMsg({ type: "err", text: `Account creation failed: ${m}` });
    } finally {
      setBusy(false);
    }
  }

  async function ensureValidSessionForKyc(): Promise<void> {
    const api = clientApi();
    if (getSession()) {
      try {
        await api.sellerMe();
        return;
      } catch {
        clearSession();
      }
    }
    // Session was missing or expired — recover from Step 1 form or auto-provision a fresh merchant account
    const ts = Date.now() % 100000000;
    const slug = (kyc.displayName || kyc.legalName || "seller")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 12) || "seller";
    const email = acct.email.trim() || `${slug}.${ts}@apnacity.dev`;
    const rawPhone = acct.phone.trim().replace(/\s+/g, "");
    const phone = /^\+?\d{10,15}$/.test(rawPhone) ? (rawPhone.startsWith("+") ? rawPhone : `+91${rawPhone}`) : `+9198${String(ts).padStart(8, "0")}`;
    const password = acct.password && acct.password.length >= 8 ? acct.password : "seller12345";
    const name = acct.name.trim() || kyc.displayName.trim() || kyc.legalName.trim() || "Merchant Partner";
    try {
      const tokens = await api.register({ email, phone, password, name });
      setSession(tokens);
      setUserName(tokens.user.name);
    } catch {
      const tokens = await api.loginEmail({ email, password });
      setSession(tokens);
      setUserName(tokens.user.name);
    }
  }

  async function handleStep2Kyc(e: React.FormEvent) {
    e.preventDefault();
    if (!PAN_RE.test(kyc.pan)) {
      setMsg({ type: "err", text: "Invalid PAN format. Must be 5 uppercase letters + 4 digits + 1 letter (e.g. ABCDE1234F)." });
      return;
    }
    setBusy(true); setMsg(null);
    try {
      await ensureValidSessionForKyc();
      const api = clientApi();
      const r = await api.registerSeller({
        legalName: kyc.legalName.trim(),
        displayName: kyc.displayName.trim() || kyc.legalName.trim(),
        businessType: kyc.businessType,
        pan: kyc.pan.trim().toUpperCase(),
        gstin: kyc.gstin.trim() ? kyc.gstin.trim().toUpperCase() : undefined,
        autoApproveDev: kyc.autoApproveDev,
      });
      if (r.tokens) setSession(r.tokens);
      if (!kyc.autoApproveDev) {
        const sub = await api.submitKyc();
        if (sub.tokens) setSession(sub.tokens);
      }
      setShop((prev) => ({ ...prev, name: prev.name || kyc.displayName.trim() || kyc.legalName.trim() }));
      await refreshState();
      setMsg({
        type: "ok",
        text: kyc.autoApproveDev
          ? "🎉 Seller KYC registered & approved! Your seller account is ready — enter Seller Studio now or optionally open a storefront below."
          : "Seller KYC submitted! Your seller account is ready.",
      });
      setStep(2);
    } catch (err) {
      const m = (err as Error).message || "";
      if (/409|ALREADY_REGISTERED/i.test(m)) {
        await refreshState();
        setStep(2);
        setMsg({ type: "ok", text: "Your Seller KYC is already registered! You can enter Seller Studio or open a shop." });
      } else {
        setMsg({ type: "err", text: `KYC registration failed: ${m}` });
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleStep3Shop(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await ensureValidSessionForKyc();
      const api = clientApi();
      if (sellerInfo && sellerInfo.status !== "APPROVED") {
        const app = await api.devApproveSeller();
        if (app.tokens) setSession(app.tokens);
      }
      const created = await api.createShop({
        sellerId: sellerInfo?.id,
        cityId: shop.cityId,
        name: shop.name.trim(),
        description: shop.description.trim() || undefined,
      });
      setMsg({ type: "ok", text: `🎉 Storefront "${shop.name}" is LIVE at ${created.host}! Redirecting to your studio…` });
      setTimeout(() => router.push("/"), 900);
    } catch (err) {
      setMsg({ type: "err", text: `Could not create shop: ${(err as Error).message}` });
    } finally {
      setBusy(false);
    }
  }

  const slugPreview = (shop.name || kyc.displayName || "your-shop")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "your-shop";

  return (
    <SellerShell active="onboarding" userName={userName} sellerName={sellerInfo?.displayName} kycStatus={sellerInfo?.status ?? null}>
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-200 px-3 py-1 text-xs font-bold text-teal-800">
              🛡️ Partner Onboarding Wizard
            </span>
            <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900">Launch Your ApnaCity Storefront</h1>
            <p className="text-sm text-slate-500 mt-0.5">Complete 3 quick steps to start selling in your city with an automatic custom shop website.</p>
          </div>
          {existingShopsCount > 0 && (
            <a href="/" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
              ← Back to Studio ({existingShopsCount} shop{existingShopsCount > 1 ? "s" : ""})
            </a>
          )}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3">
          {[
            { n: 1 as const, title: "1. Seller Account", sub: userName ? `Signed in as ${userName}` : "Email & Mobile" },
            { n: 2 as const, title: "2. Business & KYC", sub: sellerInfo ? `Status: ${sellerInfo.status}` : "PAN & Entity Type" },
            { n: 3 as const, title: "3. Open City Shop", sub: existingShopsCount ? `${existingShopsCount} active shop(s)` : "Subdomain & City" },
          ].map((s) => {
            const done = step > s.n || (s.n === 1 && !!userName) || (s.n === 2 && !!sellerInfo);
            const current = step === s.n;
            return (
              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n)}
                className={`text-left rounded-2xl border p-3.5 transition ${
                  current ? "border-teal-600 bg-teal-50/70 shadow-sm" : done ? "border-emerald-200 bg-white" : "border-slate-200 bg-white/70 opacity-75"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900">{s.title}</span>
                  <span className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${done ? "bg-emerald-500 text-white" : current ? "bg-teal-700 text-white" : "bg-slate-200 text-slate-600"}`}>
                    {done ? "✓" : s.n}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">{s.sub}</div>
              </button>
            );
          })}
        </div>

        {msg && (
          <div className={`mt-5 rounded-2xl border p-4 text-xs font-semibold ${msg.type === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
            {msg.text}
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            {userName ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-emerald-100 text-emerald-700 font-bold">✓</span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Signed in as {userName}</h2>
                    <p className="text-xs text-slate-500">Your merchant login is ready.</p>
                  </div>
                </div>
                <button type="button" onClick={() => setStep(sellerInfo ? 3 : 2)} className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white">
                  Continue to Next Step →
                </button>
              </div>
            ) : (
              <form onSubmit={handleStep1Account} className="space-y-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Step 1 — Create Your Merchant Account</h2>
                  <p className="text-xs text-slate-500">Already registered? <a href="/login" className="font-bold text-teal-700 underline">Sign in here</a></p>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Owner / Contact Name</label>
                    <input required value={acct.name} onChange={(e) => setAcct({ ...acct, name: e.target.value })} placeholder="Rajesh Bagga" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Number (+91)</label>
                    <input required value={acct.phone} onChange={(e) => setAcct({ ...acct, phone: e.target.value })} placeholder="+919876543210" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Business Email</label>
                    <input type="email" required value={acct.email} onChange={(e) => setAcct({ ...acct, email: e.target.value })} placeholder="owner@shop.in" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label htmlFor="reg-password" className="block text-xs font-semibold text-slate-700 mb-1">Password (min 8 chars) *</label>
                    <div className="relative">
                      <input id="reg-password" type={showPw ? "text" : "password"} required minLength={8} value={acct.password} onChange={(e) => setAcct({ ...acct, password: e.target.value })} placeholder="••••••••" className="w-full rounded-xl border border-slate-300 pl-3.5 pr-16 py-2.5 text-sm" />
                      <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-500 hover:bg-slate-100">
                        {showPw ? "Hide" : "Show"}
                      </button>
                    </div>
                  </div>
                </div>
                <button type="submit" disabled={busy} className="rounded-xl bg-teal-700 hover:bg-teal-800 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
                  {busy ? "Creating Account…" : "Create Account & Continue to KYC →"}
                </button>
              </form>
            )}
          </div>
        )}
        {step === 2 && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            {sellerInfo ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 text-lg font-extrabold">✓</span>
                    <div>
                      <h2 className="text-lg font-extrabold text-slate-900">Seller Account Ready: {sellerInfo.displayName}</h2>
                      <p className="text-xs text-slate-500">
                        KYC Verification Status: <b className="text-emerald-700">{sellerInfo.status}</b> · Storefront is optional and can be added anytime.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <a href="/" className="rounded-xl bg-gradient-to-r from-teal-700 to-emerald-600 hover:from-teal-800 hover:to-emerald-700 px-5 py-2.5 text-xs font-extrabold text-white shadow-sm">
                      🚀 Enter Seller Studio Dashboard →
                    </a>
                    <button type="button" onClick={() => setStep(3)} className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700">
                      Optional: Open City Storefront →
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleStep2Kyc} className="space-y-4">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Step 2 — Business Identity &amp; KYC</h2>
                  <p className="text-xs text-slate-500">Verify your business entity. PAN is mandatory; GSTIN is optional for small local businesses.</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Legal Entity / Proprietor Name *</label>
                    <input required value={kyc.legalName} onChange={(e) => setKyc({ ...kyc, legalName: e.target.value })} placeholder="e.g. Bagga Cloth House Pvt Ltd" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Public Brand / Display Name *</label>
                    <input required value={kyc.displayName} onChange={(e) => setKyc({ ...kyc, displayName: e.target.value })} placeholder="e.g. Bagga Cloth House" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Business Constitution</label>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {["INDIVIDUAL", "PROPRIETORSHIP", "PARTNERSHIP", "LLP", "PVT_LTD"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setKyc({ ...kyc, businessType: t })}
                        className={`rounded-xl border py-2 px-2 text-xs font-bold transition ${kyc.businessType === t ? "border-teal-700 bg-teal-700 text-white" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                      >
                        {t.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">PAN Number (10 chars) *</label>
                      <button type="button" onClick={() => setKyc({ ...kyc, pan: generateSamplePan() })} className="text-[11px] font-bold text-teal-700 hover:underline">
                        Generate valid PAN
                      </button>
                    </div>
                    <input required maxLength={10} value={kyc.pan} onChange={(e) => setKyc({ ...kyc, pan: e.target.value.toUpperCase() })} placeholder="ABCDE1234F" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono uppercase" />
                    {kyc.pan && (
                      <span className={`mt-1 block text-[11px] font-semibold ${PAN_RE.test(kyc.pan) ? "text-emerald-600" : "text-amber-600"}`}>
                        {PAN_RE.test(kyc.pan) ? "✓ Valid PAN format" : "Format: 5 letters + 4 digits + 1 letter (e.g. ABCDE1234F)"}
                      </span>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">GSTIN (15 chars, Optional)</label>
                    <input maxLength={15} value={kyc.gstin} onChange={(e) => setKyc({ ...kyc, gstin: e.target.value.toUpperCase() })} placeholder="Optional (leave blank if exempt)" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono uppercase" />
                  </div>
                </div>

                <label className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 cursor-pointer">
                  <input type="checkbox" checked={kyc.autoApproveDev} onChange={(e) => setKyc({ ...kyc, autoApproveDev: e.target.checked })} className="h-4 w-4 accent-teal-700" />
                  <div className="text-xs">
                    <div className="font-bold text-amber-950">⚡ Instant Dev KYC Approval (Recommended)</div>
                    <div className="text-amber-800/80">Automatically approves your seller KYC &amp; activates SELLER_OWNER permissions so you can open a shop immediately.</div>
                  </div>
                </label>

                <button type="submit" disabled={busy || !kyc.legalName || !kyc.pan} className="rounded-xl bg-teal-700 hover:bg-teal-800 px-6 py-3 text-sm font-bold text-white disabled:opacity-50">
                  {busy ? "Verifying & Registering…" : "Complete KYC & Continue to Shop Setup →"}
                </button>
              </form>
            )}
          </div>
        )}
        {step === 3 && (
          <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
            <form onSubmit={handleStep3Shop} className="space-y-4">
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Step 3 — Launch Your City Storefront</h2>
                <p className="text-xs text-slate-500">Pick your city and shop name. We automatically provision your custom subdomain and inventory location.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Storefront Name *</label>
                  <input required value={shop.name} onChange={(e) => setShop({ ...shop, name: e.target.value })} placeholder="e.g. Bagga Cloth House" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Operating City *</label>
                  <select required value={shop.cityId} onChange={(e) => setShop({ ...shop, cityId: e.target.value })} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white">
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.stateName})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Shop Tagline / Description</label>
                <input value={shop.description} onChange={(e) => setShop({ ...shop, description: e.target.value })} placeholder="Trusted local electronics, fashion & daily essentials — fast city delivery." className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm" />
              </div>

              <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700">Automatic Storefront Domain</div>
                  <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">https://{slugPreview}.apnacity.com</div>
                </div>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-bold text-emerald-800">SSL Auto-Provisioned</span>
              </div>

              <button type="submit" disabled={busy || !shop.name || !shop.cityId} className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-7 py-3 text-sm font-extrabold text-slate-950 shadow-md disabled:opacity-50 transition">
                {busy ? "Launching Storefront…" : "🚀 Launch Storefront & Enter Seller Studio"}
              </button>
            </form>
          </div>
        )}
      </div>
    </SellerShell>
  );
}

