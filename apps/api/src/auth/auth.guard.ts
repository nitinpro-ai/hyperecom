import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  SetMetadata,
  createParamDecorator,
} from "@nestjs/common";
import { verifyAccess, type AccessClaims } from "./auth.crypto";

/** Routes decorated @Public() skip the JWT guard (e.g. /auth/otp/*). */
export const IS_PUBLIC = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** @Roles('CITY_ADMIN', ...) — required roles for RolesGuard. */
export const ROLES_KEY = "roles";
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/** @CurrentUser() — the verified JWT claims attached by JwtAuthGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessClaims | undefined =>
    ctx.switchToHttp().getRequest().user,
);

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly secret = process.env.JWT_SECRET ?? "dev-secret") {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    // Public routes set via Reflector metadata are handled by the caller binding;
    // here we also allow an explicit header-less pass when flagged on the request.
    if (req[IS_PUBLIC] === true) return true;

    const header: string | undefined = req.headers?.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException("missing bearer token");
    const token = header.slice("Bearer ".length);

    const result = verifyAccess(token, this.secret, Date.now());
    if (!result.ok) throw new UnauthorizedException(`token ${result.reason}`);

    req.user = result.claims; // {sub, roles, shopId?, cityId?}
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const required: string[] | undefined = Reflect.getMetadata?.(
      ROLES_KEY,
      ctx.getHandler(),
    );
    if (!required || required.length === 0) return true;
    const user: AccessClaims | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) return false;
    return required.some((r) => user.roles.includes(r));
  }
}
