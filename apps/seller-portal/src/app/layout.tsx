import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApnaCity Seller — अपनी दुकान, ऑनलाइन",
  description: "Manage your shop, products, orders and payments. अपनी दुकान ऑनलाइन चलाएँ।",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
