import type { MetadataRoute } from "next";
import { api, safe } from "../lib/api";

/**
 * Marketplace sitemap: home + category landings + (when the API is reachable)
 * product pages. Falls back to the static routes if the API is down.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.WEB_BASE_URL ?? "https://apnacity.com";
  const now = new Date();

  const categories = await safe(() => api.categories(), []);
  const categoryRoutes = categories.map((c) => ({
    url: `${base}/category/${c.slug}`,
    lastModified: now,
    changeFrequency: "daily" as const,
  }));

  return [
    { url: base, lastModified: now, changeFrequency: "daily", priority: 1 },
    ...categoryRoutes,
  ];
}
