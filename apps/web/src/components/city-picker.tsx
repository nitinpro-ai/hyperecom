"use client";
import { useEffect, useRef, useState } from "react";
import { setCityId } from "../lib/session";

/**
 * City selector in the top bar. Dev has one pilot city (Bijnor); the control
 * still opens and is selectable (the previous build rendered a dead <button>).
 * Selecting a city persists its id via setCityId() so cart/checkout/search are
 * scoped to it. When the API later exposes a /cities list this reads it; until
 * then it shows the Bijnor pilot.
 */
const DEV_CITIES = [{ id: "", name: "Bijnor", state: "Uttar Pradesh" }];

export function CityPicker({ initialCity = "Bijnor" }: { initialCity?: string }) {
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState(initialCity);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function choose(c: { id: string; name: string }) {
    setCity(c.name);
    setCityId(c.id);
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-brand sm:text-sm"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-5.5-7-11a7 7 0 1114 0c0 5.5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>
        <span className="max-w-24 truncate">{city}</span>
        <span className="text-ink-3">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 w-48 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="border-b border-line px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-3">Choose your city</div>
          {DEV_CITIES.map((c) => (
            <button
              key={c.name}
              type="button"
              onClick={() => choose(c)}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-tint ${c.name === city ? "font-semibold text-brand" : "text-ink-2"}`}
            >
              <span>{c.name}<span className="block text-[11px] text-ink-3">{c.state}</span></span>
              {c.name === city && <span className="text-brand">✓</span>}
            </button>
          ))}
          <div className="border-t border-line px-3 py-2 text-[11px] text-ink-3">More cities coming soon</div>
        </div>
      )}
    </div>
  );
}
