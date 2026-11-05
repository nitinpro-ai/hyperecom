import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApnaCity — Your city. Your shops. Delivered.",
  description:
    "Shop from real local stores in your city: compare prices across shops, order online, get local delivery.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
