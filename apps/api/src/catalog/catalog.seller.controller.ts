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
    // Auto-fill any required category schema attributes with sensible defaults if not supplied by the seller UI
    const cat = await prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { attributeSchema: true },
    });
    const mergedAttrs: Record<string, unknown> = { ...(dto.attributes ?? {}) };
    const schema = Array.isArray(cat?.attributeSchema)
      ? (cat.attributeSchema as Array<{ key: string; type: string; values?: string[]; required?: boolean }>)
      : [];
    for (const spec of schema) {
      const val = mergedAttrs[spec.key];
      const present = val !== undefined && val !== null && val !== "";
      if (!present && spec.required) {
        if (spec.type === "enum" && spec.values?.length) mergedAttrs[spec.key] = spec.values[0];
        else if (spec.type === "number") mergedAttrs[spec.key] = 1;
        else if (spec.type === "boolean") mergedAttrs[spec.key] = true;
        else mergedAttrs[spec.key] = String(mergedAttrs.unit ?? "Standard");
      } else if (present && spec.type === "enum" && spec.values?.length && !spec.values.includes(String(val))) {
        mergedAttrs[spec.key] = spec.values[0];
      }
    }

    const r = await this.catalog.matchOrCreate({
      categoryId: dto.categoryId, name: dto.name, description: dto.description,
      gtin: dto.gtin, attributes: mergedAttrs, brandId: dto.brandId, createdBy: u.sub,
    });
    if (!r.ok) throw new HttpException({ error: r.reason, message: r.reason, errors: r.errors }, r.reason === "CATEGORY_NOT_FOUND" ? 404 : 422);

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
