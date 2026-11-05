import { brand } from "@apnacity/ui";

/**
 * Step 1 placeholder home. Step 2–3 replace with the real geo-select →
 * city home (COMPLETE-BUILD-GUIDE PART IV "Marketplace screens" ①–②).
 */
export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="text-6xl">🛍️</div>
      <h1 className="text-4xl font-bold" style={{ color: brand.colors.primary }}>
        {brand.name}
      </h1>
      <p className="text-xl text-gray-600">{brand.tagline.EN}</p>
      <p className="rounded-lg bg-gray-100 px-4 py-2 font-mono text-sm text-gray-500">
        apps/web · scaffold complete — build Step 1 ✅ · next: geo-select (Step 2–3)
      </p>
    </main>
  );
}
