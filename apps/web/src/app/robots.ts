import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.WEB_BASE_URL ?? "https://apnacity.com";
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/checkout", "/account", "/me"] }],
    sitemap: `${base}/sitemap.xml`,
  };
}
