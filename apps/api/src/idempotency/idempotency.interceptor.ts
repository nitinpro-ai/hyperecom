import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable, from, of, switchMap, tap } from "rxjs";
import { createHash } from "node:crypto";
import { IdempotencyService } from "./idempotency.service";

/**
 * M30 — applies idempotency to mutating POSTs carrying an `Idempotency-Key`.
 *
 * Flow (spec M30):
 *   same key + same request hash  → return the stored response (replay)
 *   same key + different request  → 409 Conflict
 *   first time                    → run handler, store {status, body}, TTL 24 h
 *
 * Requests without the header pass straight through (header is opt-in per route;
 * checkout/place-order will require it at Step 11).
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly svc: IdempotencyService) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    if (req.method !== "POST") return next.handle();

    const key: string | undefined = req.headers["idempotency-key"];
    if (!key) return next.handle();

    const userId: string = req.user?.id ?? "00000000-0000-0000-0000-000000000000";
    const endpoint: string = `${req.method} ${req.route?.path ?? req.url}`;
    const requestHash = createHash("sha256")
      .update(JSON.stringify({ endpoint, body: req.body ?? null }))
      .digest("hex");

    return from(this.svc.lookup(key, userId, endpoint, requestHash)).pipe(
      switchMap((lookup) => {
        if (lookup.kind === "replay") {
          const res = ctx.switchToHttp().getResponse();
          res.status(lookup.response.status);
          return of(lookup.response.body);
        }
        if (lookup.kind === "conflict") {
          throw new HttpException(
            "Idempotency-Key reused with a different request",
            409,
          );
        }
        // fresh — reserve, run handler, persist response (or release on error)
        return from(this.svc.reserve(key, userId, endpoint, requestHash)).pipe(
          switchMap((reserved) => {
            if (!reserved) {
              throw new HttpException("Idempotent request already in progress", 409);
            }
            return next.handle().pipe(
              switchMap((body) => {
                const status = ctx.switchToHttp().getResponse().statusCode ?? 200;
                return from(this.svc.persist(key, { status, body })).pipe(
                  switchMap(() => of(body)),
                );
              }),
              tap({
                error: () => {
                  void this.svc.release(key);
                },
              }),
            );
          }),
        );
      }),
    );
  }
}
