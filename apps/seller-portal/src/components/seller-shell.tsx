"use client";
import type { ReactNode } from "react";
import { clearSession, WEB_MARKETPLACE_URL } from "../lib/session";

export interface SellerShellProps {
  active: "dashboard" | "products" | "new-product" | "onboarding";
  userName?: string;
  sellerName?: string;
  kycStatus?: string | null;
  activeShop?: { id: string; name: string; slug: string; cityName: string; host: string } | null;
  pendingOrdersCount?: number;
  onDevApprove?: () => void;
  children: ReactNode;
}

export function SellerShell({
  active,
  userName,
  sellerName,
  kycStatus,
  activeShop,
  pendingOrdersCount = 0,
  onDevApprove,
  children,
}: SellerShellProps) {
  const nav = [
    { key: "dashboard", href: "/", label: "Overview & Orders", badge: pendingOrdersCount > 0 ? String(pendingOrdersCount) : undefined, icon: "📊" },
    { key: "products", href: "/products", label: "Products & Stock", icon: "📦" },
    { key: "new-product", href: "/products/new", label: "Add New Product", icon: "✨" },
    { key: "onboarding", href: "/register", label: "Business & KYC", icon: "🛡️" },
  ] as const;

  const statusTone =
    kycStatus === "APPROVED"
      ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30"
      : kycStatus === "KYC_PENDING"
        ? "bg-amber-500/15 text-amber-300 border-amber-400/30"
        : "bg-slate-500/20 text-slate-300 border-slate-400/30";

  return (
    <div className="studio-mesh min-h-screen flex flex-col lg:flex-row">
      <aside className="hero-sidebar text-white lg:w-72 lg:shrink-0 lg:min-h-screen flex flex-col justify-between p-5 border-b lg:border-b-0 lg:border-r border-white/10">
        <div>
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 text-lg font-black text-slate-950 shadow-lg">A</span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight">ApnaCity</span>
                  <span className="rounded-md bg-amber-400/20 border border-amber-400/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">Seller Studio</span>
                </div>
                <p className="text-xs text-teal-200/75">अपनी दुकान, ऑनलाइन</p>
              </div>
            </a>
            <button onClick={() => { clearSession(); location.href = "/login"; }} className="lg:hidden rounded-lg border border-white/15 px-2.5 py-1 text-xs text-white/80">
              Sign out
            </button>
          </div>
          <div className="mt-6 rounded-2xl border border-white/12 bg-white/6 p-3.5 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-200/70">Merchant Status</span>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusTone}`}>
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
                {kycStatus ?? "UNREGISTERED"}
              </span>
            </div>
            <div className="mt-2 font-bold text-sm truncate">
              {activeShop ? activeShop.name : sellerName || userName || "New Merchant"}
            </div>
            {activeShop ? (
              <div className="mt-1 flex items-center justify-between text-xs text-teal-100/75">
                <span className="truncate">📍 {activeShop.cityName}</span>
                <a
                  href={`${WEB_MARKETPLACE_URL}/search?shopId=${encodeURIComponent(activeShop.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-amber-300 hover:underline shrink-0"
                >
                  View Store ↗
                </a>
              </div>
            ) : (
              <p className="mt-1 text-xs text-teal-100/70">Complete onboarding to launch your city storefront.</p>
            )}
            {kycStatus && kycStatus !== "APPROVED" && onDevApprove && (
              <button
                onClick={onDevApprove}
                className="mt-2.5 w-full rounded-lg bg-amber-400 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-300 transition"
              >
                ⚡ Instant Approve KYC (Dev)
              </button>
            )}
          </div>

          <nav className="mt-5 flex lg:flex-col gap-1.5 overflow-x-auto pb-1 lg:pb-0">
            {nav.map((item) => {
              const isOn = active === item.key;
              return (
                <a
                  key={item.key}
                  href={item.href}
                  className={`flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition whitespace-nowrap ${
                    isOn
                      ? "bg-gradient-to-r from-teal-500/30 to-emerald-500/15 text-white border border-teal-400/40 shadow-sm"
                      : "text-slate-300 hover:bg-white/8 hover:text-white border border-transparent"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  {"badge" in item && item.badge && (
                    <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-extrabold text-slate-950">
                      {item.badge}
                    </span>
                  )}
                </a>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block pt-5 border-t border-white/10 space-y-3">
          <a
            href={WEB_MARKETPLACE_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-medium text-teal-100 hover:bg-white/10 transition"
          >
            <span>🛍️ Customer Marketplace</span>
            <span>↗</span>
          </a>
          <div className="flex items-center justify-between px-1">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{userName || "Seller Account"}</div>
              <div className="text-[11px] text-slate-400">ApnaCity Partner</div>
            </div>
            <button
              onClick={() => { clearSession(); location.href = "/login"; }}
              className="rounded-lg border border-white/15 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white transition"
            >
              Logout
            </button>
          </div>
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </div>
    </div>
  );
}
