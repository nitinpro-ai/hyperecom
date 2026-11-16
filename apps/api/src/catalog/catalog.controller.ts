import { Controller, Get, Inject, Param, Query, HttpException } from "@nestjs/common";
import { CatalogService } from "./catalog.service";
import { prisma } from "@apnacity/db";

/** M07 — public catalog reads (no auth): category tree + product detail. */
@Controller()
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get("categories")
  categories() {
    return this.catalog.categoryTree();
  }

  /** Master product + variants + media (PDP header data). */
  @Get("products/:id")
  async product(@Param("id") id: string, @Query("variantId") _variantId?: string) {
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true, name: true, slug: true, description: true, gtin: true,
        attributes: true, status: true,
        brand: { select: { name: true, slug: true } },
        category: { select: { id: true, name: true, slug: true } },
        variants: {
          where: { isActive: true },
          select: { id: true, sku: true, attributes: true },
        },
      },
    });
    if (!product || product.status !== "ACTIVE") throw new HttpException("product not found", 404);
    return product;
  }
}
