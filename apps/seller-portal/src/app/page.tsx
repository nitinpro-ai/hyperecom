/**
 * Step 1 placeholder. Step 5 (S2–S3) builds the onboarding wizard here —
 * Hindi-first UX is a hard requirement (COMPLETE-BUILD-GUIDE W1 + PART IV).
 */
export default function SellerHomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="text-6xl">🏪</div>
      <h1 className="text-4xl font-bold text-teal-700">ApnaCity Seller</h1>
      <p className="text-xl text-gray-600">अपनी दुकान ऑनलाइन चलाएँ · Run your shop online</p>
      <p className="rounded-lg bg-gray-100 px-4 py-2 font-mono text-sm text-gray-500">
        apps/seller-portal · scaffold complete ✅ · next: onboarding wizard (Step 5)
      </p>
    </main>
  );
}
