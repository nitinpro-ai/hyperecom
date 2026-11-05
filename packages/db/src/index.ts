import { PrismaClient } from "@prisma/client";

/**
 * Shared Prisma client for the whole API (module repositories receive this
 * instance; each module still owns its tables exclusively — D-015).
 * The API sets `app.current_tenant` per request for RLS (added in Step 4).
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export * from "@prisma/client";
