import { PrismaClient, Prisma } from "@prisma/client";

/**
 * Shared Prisma client for the whole API (module repositories receive this
 * instance; each module still owns its tables exclusively — D-015).
 * The API sets `app.current_tenant` per request for RLS (added in Step 4).
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

// Re-export explicitly (NOT `export *`): the star form re-exports a huge
// namespace and, under CJS interop, can leave the local `prisma` binding in a
// temporal-dead-zone (undefined) for consumers that import `{ prisma, Prisma }`
// together — which crashed search.service in the compiled build. Explicit
// named re-exports make init order deterministic.
export { Prisma, PrismaClient };
export type * from "@prisma/client";

