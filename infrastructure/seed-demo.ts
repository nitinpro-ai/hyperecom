import { PrismaClient } from "@prisma/client";

/**
 * Demo data seed for the LIVE cluster — creates a visible storefront + PDP with
 * a multi-shop offers table, so the deployed web app shows REAL data (not the
 * demo fallback). Idempotent-ish: tagged rows, safe to re-run after cleanup.
 * Run: DATABASE_URL=...:30432 tsx infrastructure/seed-demo.ts
 */
const prisma = new PrismaClient();
const TAG = "demo";

async function main() {
  const city = await prisma.city.findUniqueOrThrow({ where: { slug: "bijnor" } });

  // Category with an attribute schema
  const category = await prisma.category.upsert({
    where: { slug: "demo-fashion" },
    update: {},
    create: {
      name: "Fashion", slug: "demo-fashion", pathText: "root.fashion",
      attributeSchema: [{ key: "size", type: "enum", values: ["S", "M", "L", "XL"], required: true }],
    },
  });

  // One shared master product + a variant (the thing multiple shops will offer)
  const product = await prisma.product.upsert({
    where: { slug: "demo-mens-cotton-shirt" },
    update: {},
    create: {
      categoryId: category.id, name: "Men's Cotton Shirt (Blue)", slug: "demo-mens-cotton-shirt",
      description: "Pure cotton regular-fit shirt. Offered by several local shops — compare prices.",
      gtin: "8901234567894", attributes: { size: "M" }, status: "ACTIVE",
    },
  });
  let variant = await prisma.productVariant.findFirst({ where: { productId: product.id } });
  if (!variant) {
    variant = await prisma.productVariant.create({
      data: { productId: product.id, sku: "DEMO-SHIRT-M", attributes: { size: "M" } },
    });
  }

  // Three shops, each with an ACTIVE listing + stock → a 3-row offers table.
  const shopDefs = [
    { slug: "bagga-cloth", name: "Bagga Cloth", price: 79900 },
    { slug: "fashion-hub", name: "Fashion Hub", price: 84900 },
    { slug: "city-traders", name: "City Traders", price: 76900 },
  ];

  for (const sd of shopDefs) {
    const user = await prisma.user.upsert({
      where: { phone: `+9190000${sd.slug.length}${sd.name.length}00` },
      update: {},
      create: { phone: `+9190000${sd.slug.length}${sd.name.length}00`, name: `${TAG}-${sd.slug}` },
    });
    const seller = await prisma.seller.upsert({
      where: { userId: user.id },
      update: { status: "APPROVED" },
      create: {
        userId: user.id, legalName: sd.name, displayName: sd.name,
        businessType: "PROPRIETORSHIP", pan: "ABCDE1234F", status: "APPROVED",
      },
    });
    const shop = await prisma.shop.upsert({
      where: { slug: sd.slug },
      update: { status: "ACTIVE" },
      create: { sellerId: seller.id, cityId: city.id, name: sd.name, slug: sd.slug, status: "ACTIVE" },
    });
    await prisma.shopDomain.upsert({
      where: { shopId: shop.id },
      update: {},
      create: { shopId: shop.id, host: `${sd.slug}.apnacity.com`, hostType: "SUBDOMAIN", sslStatus: "ACTIVE" },
    });
    await prisma.shopSettings.upsert({ where: { shopId: shop.id }, update: {}, create: { shopId: shop.id } });

    const listing = await prisma.sellerListing.upsert({
      where: { shopId_productId: { shopId: shop.id, productId: product.id } },
      update: { status: "ACTIVE", listedAt: new Date() },
      create: { shopId: shop.id, productId: product.id, status: "ACTIVE", listedAt: new Date() },
    });
    const existingLv = await prisma.listingVariant.findFirst({ where: { listingId: listing.id, variantId: variant.id } });
    const lv = existingLv ?? await prisma.listingVariant.create({
      data: {
        listingId: listing.id, shopId: shop.id, variantId: variant.id,
        sellerSku: `${sd.slug}-shirt-m`, mrpPaise: 119900n, pricePaise: BigInt(sd.price),
      },
    });
    // stock
    const loc = await prisma.inventoryLocation.findFirst({ where: { shopId: shop.id } })
      ?? await prisma.inventoryLocation.create({ data: { shopId: shop.id, name: "Shop Floor" } });
    const hasStock = await prisma.stock.findFirst({ where: { locationId: loc.id, listingVariantId: lv.id } });
    if (!hasStock) {
      await prisma.stock.create({ data: { locationId: loc.id, listingVariantId: lv.id, quantityOnHand: 25, quantityReserved: 0 } });
    }
  }

  console.log(`✅ Demo seeded. Product ${product.id} offered by ${shopDefs.length} shops.`);
  console.log(`   PDP:        /product/${product.id}?variantId=${variant.id}`);
  console.log(`   Storefront: /shop/bagga-cloth`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
