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
