import { Body, Controller, Inject, Post, HttpException, UseGuards } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { CatalogService } from "./catalog.service";
import { JwtAuthGuard, RolesGuard, Roles, CurrentUser } from "../auth/auth.guard";
import type { AccessClaims } from "../auth/auth.crypto";

interface CreateProductDto {
  categoryId: string;
  name: string;
  description?: string;
  gtin?: string;
  attributes?: Record<string, unknown>;
  brandId?: string;
  /** optional first variant to create alongside (the wizard needs one to list) */
  variant?: { sku?: string; attributes?: Record<string, unknown> };
}

/** M07 — seller product create (authed SELLER): match-or-create a master product + a variant. */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("SELLER_OWNER", "SELLER_STAFF", "SUPER_ADMIN")
export class CatalogSellerController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Post("catalog/products")
  async create(@CurrentUser() u: AccessClaims, @Body() dto: CreateProductDto) {
    const r = await this.catalog.matchOrCreate({
      categoryId: dto.categoryId, name: dto.name, description: dto.description,
      gtin: dto.gtin, attributes: dto.attributes, brandId: dto.brandId, createdBy: u.sub,
    });
    if (!r.ok) throw new HttpException({ error: r.reason, errors: r.errors }, r.reason === "CATEGORY_NOT_FOUND" ? 404 : 422);

    // ensure at least one variant exists for the wizard to create a listing against
    let variant = await prisma.productVariant.findFirst({ where: { productId: r.productId }, select: { id: true } });
    if (!variant) {
      variant = await prisma.productVariant.create({
        data: { productId: r.productId, sku: dto.variant?.sku ?? null, attributes: (dto.variant?.attributes ?? {}) as object },
        select: { id: true },
      });
    }
    return { productId: r.productId, matched: r.matched, variantId: variant.id };
  }
}
