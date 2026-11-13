import { Injectable } from "@nestjs/common";
import {
  newFamilyId,
  newRefreshToken,
} from "./auth.crypto";

/**
 * Refresh-token family tracking for rotation + reuse detection (theft).
 *
 * A "family" is one login. Each refresh rotates to a new token; the old token
 * is marked consumed. Presenting a CONSUMED token = theft → the whole family is
 * revoked (all sessions from that login die). Backed by Redis in production
 * (`refresh:{family}`); this in-memory store is the testable seam.
 */

export interface FamilyState {
  userId: string;
  current: string; // currently-valid refresh token
  consumed: Set<string>; // previously-rotated tokens
  revoked: boolean;
}

export interface RefreshStore {
  get(family: string): Promise<FamilyState | undefined>;
  put(family: string, state: FamilyState): Promise<void>;
}

export class InMemoryRefreshStore implements RefreshStore {
  private m = new Map<string, FamilyState>();
  async get(family: string) {
    return this.m.get(family);
  }
  async put(family: string, state: FamilyState) {
    this.m.set(family, state);
  }
}

export type RotateResult =
  | { ok: true; family: string; refreshToken: string }
  | { ok: false; reason: "UNKNOWN" | "REVOKED" | "REUSE_DETECTED" };

@Injectable()
export class RefreshFamilyService {
  private readonly store: RefreshStore;

  /** Store is optional for tests (pass InMemoryRefreshStore); NestJS uses the
   *  default in-memory store (Redis-backed store injected at Step 4 wiring). */
  constructor(store?: RefreshStore) {
    this.store = store ?? new InMemoryRefreshStore();
  }

  /** Start a new family at login. */
  async start(userId: string): Promise<{ family: string; refreshToken: string }> {
    const family = newFamilyId();
    const refreshToken = newRefreshToken();
    await this.store.put(family, {
      userId,
      current: refreshToken,
      consumed: new Set(),
      revoked: false,
    });
    return { family, refreshToken };
  }

  /** Rotate on /auth/refresh. Reuse of a consumed token revokes the family. */
  async rotate(family: string, presented: string): Promise<RotateResult> {
    const state = await this.store.get(family);
    if (!state) return { ok: false, reason: "UNKNOWN" };
    if (state.revoked) return { ok: false, reason: "REVOKED" };

    if (state.consumed.has(presented)) {
      // theft: an already-rotated token was replayed → kill the whole family
      state.revoked = true;
      await this.store.put(family, state);
      return { ok: false, reason: "REUSE_DETECTED" };
    }
    if (presented !== state.current) {
      return { ok: false, reason: "REVOKED" };
    }

    state.consumed.add(state.current);
    state.current = newRefreshToken();
    await this.store.put(family, state);
    return { ok: true, family, refreshToken: state.current };
  }

  /** Explicit revoke (logout / admin / password reset). */
  async revokeFamily(family: string): Promise<void> {
    const state = await this.store.get(family);
    if (state) {
      state.revoked = true;
      await this.store.put(family, state);
    }
  }

  async isRevoked(family: string): Promise<boolean> {
    return (await this.store.get(family))?.revoked ?? true;
  }

  /** The user this family belongs to (for minting a new access token on refresh). */
  async getUserId(family: string): Promise<string | undefined> {
    return (await this.store.get(family))?.userId;
  }
}
