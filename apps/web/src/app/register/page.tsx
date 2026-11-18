"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientApi, setSession } from "../../lib/session";

/**
 * Email + mobile registration (dev-friendly — no SMS). The mobile number is
 * collected on the form and stored on the user (required + unique); email +
 * password are the login credentials. On success we store the session and go
 * home, logged in.
 */
export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+91");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(""); setBusy(true);
    try {
      const s = await clientApi().register({ email, phone, password, name: name || undefined });
      setSession(s);
      router.push("/");
    } catch (err) {
      const m = (err as Error).message || "Registration failed";
      setMsg(m.includes("409") || /registered/i.test(m) ? "That email or mobile is already registered." : `Could not register: ${m}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <a href="/" className="text-2xl font-extrabold text-brand">🛍 ApnaCity</a>
      <h1 className="mt-6 text-xl font-bold">Create your account</h1>
      <p className="mt-1 text-sm text-ink-3">Register with your email. We&apos;ll also save your mobile number for delivery updates.</p>

      <form onSubmit={submit} className="mt-6 space-y-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address"
          className="w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand" />
        <input type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile number (+91XXXXXXXXXX)"
          className="w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand" />
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name"
          className="w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand" />
        <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8 characters)"
          className="w-full rounded-lg border border-line px-3 py-2.5 outline-none focus:border-brand" />
        <button type="submit" disabled={busy} className="w-full rounded-full bg-brand py-3 font-bold text-white disabled:opacity-50">
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>

      {msg && <p className="mt-4 rounded-lg bg-brand-tint p-3 text-xs text-ink-2">{msg}</p>}

      <p className="mt-6 text-center text-sm text-ink-3">
        Already have an account? <a href="/login" className="font-semibold text-brand">Log in</a>
      </p>
    </div>
  );
}
