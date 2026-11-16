/**
 * Placeholder client. From Step 4 onward this package is REGENERATED from the
 * NestJS OpenAPI spec on every API build (CI fails if stale — spec/11 §4).
 * Hand-written fetch helpers below cover Step 1's health check only.
 */

export interface ApiClientOptions {
  baseUrl: string;
  getAccessToken?: () => string | undefined;
}

export function createApiClient({ baseUrl, getAccessToken }: ApiClientOptions) {
  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    const token = getAccessToken?.();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const res = await fetch(`${baseUrl}/v1${path}`, { ...init, headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { code?: string; message?: string; traceId?: string } }
        | null;
      throw new ApiError(res.status, body?.error?.code, body?.error?.message, body?.error?.traceId);
    }
    return (await res.json()) as T;
  }

  return {
    health: () => request<{ status: "ok"; service: string; time: string }>("/health"),

    // --- M07 catalog (public reads) ---
    categories: () =>
      request<Array<{ id: string; parentId: string | null; name: string; slug: string; pathText: string }>>(
        "/categories",
      ),
    product: (id: string) =>
      request<{
        id: string; name: string; slug: string; description: string | null; gtin: string | null;
        attributes: unknown; status: string;
        brand: { name: string; slug: string } | null;
        category: { id: string; name: string; slug: string };
        variants: Array<{ id: string; sku: string | null; attributes: unknown }>;
      }>(`/products/${id}`),

    // --- M08 listings (public reads) ---
    offers: (productId: string, variantId: string, cityId?: string) =>
      request<Array<{ listingVariantId: string; listingId: string; shopId: string; pricePaise: number; mrpPaise: number }>>(
        `/products/${productId}/offers?variantId=${encodeURIComponent(variantId)}${cityId ? `&cityId=${cityId}` : ""}`,
      ),
    shopCatalogue: (shopId: string) =>
      request<Array<{ listingId: string; productId: string; title: string; slug: string; pricePaise: number | null; mrpPaise: number | null }>>(
        `/shops/${shopId}/catalogue`,
      ),

    // --- M05/M06 storefront resolution ---
    resolveStorefront: (slug: string) =>
      request<{ id: string; slug: string; cityId: string; status: string; name: string }>(
        `/storefront/resolve?slug=${encodeURIComponent(slug)}`,
      ),
    resolveTenant: (host: string) =>
      request<{ shopId: string; slug: string; cityId: string }>(
        `/internal/resolve-tenant?host=${encodeURIComponent(host)}`,
      ),
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    message?: string,
    public traceId?: string
  ) {
    super(message ?? `API error ${status}`);
    this.name = "ApiError";
  }
}
