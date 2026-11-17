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
    if (init?.body) headers.set("Content-Type", "application/json");
    const res = await fetch(`${baseUrl}/v1${path}`, { ...init, headers });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: { code?: string; message?: string; traceId?: string } }
        | null;
      throw new ApiError(res.status, body?.error?.code, body?.error?.message, body?.error?.traceId);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }
  const post = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });
  const patch = <T>(path: string, body?: unknown) => request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
  const del = <T>(path: string) => request<T>(path, { method: "DELETE" });

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

    // --- M01 auth ---
    requestOtp: (phone: string) => post<{ resendIn: number }>("/auth/otp/request", { phone }),
    verifyOtp: (phone: string, otp: string, name?: string) =>
      post<{ accessToken: string; refreshToken: string; family: string; user: { id: string; name: string; roles: string[] } }>("/auth/otp/verify", { phone, otp, name }),
    me: () => request<{ id: string; phone: string; name: string; roles: Array<{ role: { name: string }; cityId: string | null; shopId: string | null }> }>("/me"),

    // --- M04/M05 seller onboarding ---
    registerSeller: (dto: { legalName: string; displayName: string; businessType: string; pan: string; gstin?: string }) =>
      post<{ sellerId: string }>("/sellers/register", dto),
    submitKyc: () => post<{ status: string }>("/sellers/me/submit-kyc"),
    createShop: (dto: { sellerId: string; cityId: string; name: string; description?: string }) =>
      post<{ shopId: string; slug: string; host: string }>("/shops", dto),

    // --- M07/M08 seller catalog + listing ---
    createProduct: (dto: { categoryId: string; name: string; description?: string; gtin?: string; attributes?: Record<string, unknown>; variant?: { sku?: string; attributes?: Record<string, unknown> } }) =>
      post<{ productId: string; matched: string; variantId: string }>("/catalog/products", dto),
    createListingDraft: (shopId: string, dto: { productId: string; titleOverride?: string; variants: Array<{ variantId: string; sellerSku: string; mrpPaise: number; pricePaise: number; taxRateBp?: number }> }) =>
      post<{ listingId: string }>(`/shops/${shopId}/listings/draft`, dto),
    publishListing: (listingId: string, imageCount = 1) =>
      post<{ status: string }>(`/listings/${listingId}/publish`, { imageCount }),

    // --- M11 search ---
    search: (q: string, params: Record<string, string> = {}) => {
      const qs = new URLSearchParams({ q, ...params }).toString();
      return request<Array<{ productId: string; name: string; shopId: string; listingVariantId: string; pricePaise: number; mrpPaise: number; inStock: boolean; relevance: number }>>(`/search?${qs}`);
    },
    suggest: (q: string) => request<string[]>(`/search/suggest?q=${encodeURIComponent(q)}`),

    // --- M12 cart ---
    getCart: () => request<{ cartId: string | null; items: Array<{ id: string; listingVariantId: string; shopId: string; quantity: number; addedPricePaise: number; currentPricePaise: number | null; drift: boolean; unavailable: boolean }>; itemsTotalPaise: number; hasDrift: boolean }>("/cart"),
    addToCart: (dto: { cityId: string; listingVariantId: string; listingId: string; shopId: string; quantity: number }) =>
      post<{ cartId: string }>("/cart/items", dto),
    updateCartItem: (id: string, quantity: number) => patch<{ ok: boolean }>(`/cart/items/${id}`, { quantity }),
    removeCartItem: (id: string) => del<{ ok: boolean }>(`/cart/items/${id}`),

    // --- M13 checkout ---
    quote: (dto: { deliveryFeePaiseByShop?: Record<string, number>; discountPaise?: number } = {}) =>
      post<{ shopGroups: Array<{ shopId: string; itemsTotalPaise: number; deliveryFeePaise: number }>; itemsTotalPaise: number; deliveryTotalPaise: number; taxTotalPaise: number; discountPaise: number; grandTotalPaise: number }>("/checkout/quote", dto),
    placeOrder: (dto: { cityId: string; addressSnapshot: Record<string, unknown>; deliveryFeePaiseByShop?: Record<string, number> }) =>
      post<{ orderId: string; orderNo: string; sellerOrderCount: number; grandTotalPaise: number }>("/orders", dto),

    // --- M14 orders ---
    myOrders: () => request<Array<{ id: string; orderNo: string; status: string; grandTotalPaise: number; createdAt: string }>>("/orders"),
    orderDetail: (id: string) => request<{ id: string; orderNo: string; status: string; grandTotalPaise: number; itemsTotalPaise: number; deliveryTotalPaise: number; addressSnapshot: unknown; sellerOrders: Array<{ id: string; shopId: string; status: string; itemsTotalPaise: number }>; items: Array<{ nameSnapshot: string; quantity: number; unitPricePaise: number; lineTotalPaise: number }> }>(`/orders/${id}`),
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
