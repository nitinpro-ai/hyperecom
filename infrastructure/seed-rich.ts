import { PrismaClient } from "@prisma/client";

/**
 * Rich demo catalog for live testing — adds several categories, ~8 shops, and
 * ~30 products with variants, stock, and cross-shop price variation so search,
 * browse, PDP comparison, cart and checkout all have real data. Idempotent by
 * slug/sku prefix "rich-". Run: DATABASE_URL=...:30432 tsx infrastructure/seed-rich.ts
 */
const prisma = new PrismaClient();
const P = "rich";

const CATEGORIES = [
  { slug: "fashion", name: "Fashion" },
  { slug: "electronics", name: "Electronics" },
  { slug: "grocery", name: "Grocery" },
  { slug: "home", name: "Home & Kitchen" },
  { slug: "sports", name: "Sports" },
  { slug: "beauty", name: "Beauty" },
];

// product templates per category: [name, mrp(₹), basePrice(₹)]
const PRODUCTS: Record<string, Array<[string, number, number]>> = {
  fashion: [["Men's Cotton Shirt", 1199, 799], ["Cotton Kurta", 999, 599], ["Slim Denim Jeans", 1999, 1499], ["Linen Casual Shirt", 1349, 899], ["Silk Saree", 4999, 3499]],
  electronics: [["boAt Bluetooth Earbuds", 2499, 1299], ["Mixer Grinder 750W", 3299, 2499], ["LED Bulb 9W (4pk)", 599, 399], ["Power Bank 20000mAh", 2999, 1799], ["USB-C Fast Charger", 999, 649]],
  grocery: [["Basmati Rice 5kg", 799, 649], ["Toor Dal 2kg", 360, 298], ["Cold-Pressed Oil 1L", 450, 389], ["Masala Chai 500g", 320, 259]],
  home: [["Non-stick Tawa", 899, 649], ["Steel Water Bottle 1L", 599, 399], ["Cotton Bedsheet Double", 1499, 999], ["Storage Container Set", 799, 549]],
  sports: [["Kashmir Willow Bat", 2599, 1899], ["Leather Football", 1299, 899], ["Yoga Mat 6mm", 999, 649], ["Badminton Racket", 1499, 999]],
  beauty: [["Ayurvedic Face Wash", 299, 229], ["Argan Hair Oil 200ml", 599, 449], ["Vitamin C Serum", 899, 649], ["Sunscreen SPF50", 499, 399]],
};

const SHOPS = ["Bagga Cloth", "Electro Hub", "City Sports", "Fashion Hub", "Daily Grocer", "Home Needs", "Glow Beauty", "Super Bazaar"];

async function main() {
  const city = await prisma.city.findFirstOrThrow({ where: { slug: "bijnor" } });

  // categories
  const cats: Record<string, string> = {};
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: `${P}-${c.slug}` },
      update: {},
      create: { slug: `${P}-${c.slug}`, name: c.name, pathText: `root.${c.slug}`, attributeSchema: [{ key: "size", type: "string", required: false }] },
    });
    cats[c.slug] = row.id;
  }

  // shops (each needs a user + APPROVED seller)
  const shopIds: string[] = [];
  for (let i = 0; i < SHOPS.length; i++) {
    const phone = `+9190${String(1000000 + i).slice(-7)}`;
    const user = await prisma.user.upsert({ where: { phone }, update: {}, create: { phone, name: `${P}-seller-${i}` } });
    const seller = await prisma.seller.upsert({ where: { userId: user.id }, update: { status: "APPROVED" }, create: { userId: user.id, legalName: SHOPS[i]!, displayName: SHOPS[i]!, businessType: "PROPRIETORSHIP", pan: "ABCDE1234F", status: "APPROVED" } });
    const slug = `${P}-${SHOPS[i]!.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const shop = await prisma.shop.upsert({ where: { slug }, update: { status: "ACTIVE" }, create: { sellerId: seller.id, cityId: city.id, name: SHOPS[i]!, slug, status: "ACTIVE" } });
    await prisma.shopSettings.upsert({ where: { shopId: shop.id }, update: {}, create: { shopId: shop.id } });
    shopIds.push(shop.id);
  }

  // products: each offered by 2–4 shops at varying prices, with stock
  let made = 0;
  for (const [catSlug, items] of Object.entries(PRODUCTS)) {
    for (const [name, mrp, base] of items) {
      const pslug = `${P}-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
      const product = await prisma.product.upsert({
        where: { slug: pslug }, update: { status: "ACTIVE" },
        create: { categoryId: cats[catSlug]!, name, slug: pslug, status: "ACTIVE", description: `${name} — quality product from local shops.` },
      });
      let variant = await prisma.productVariant.findFirst({ where: { productId: product.id } });
      if (!variant) variant = await prisma.productVariant.create({ data: { productId: product.id, sku: `${pslug}-v1`, attributes: {} } });

      const nShops = 2 + (made % 3); // 2–4 shops per product
      for (let s = 0; s < nShops; s++) {
        const shopId = shopIds[(made + s) % shopIds.length]!;
        const price = base - s * 30; // cross-shop variation
        const listing = await prisma.sellerListing.upsert({
          where: { shopId_productId: { shopId, productId: product.id } },
          update: { status: "ACTIVE", listedAt: new Date() },
          create: { shopId, productId: product.id, status: "ACTIVE", listedAt: new Date() },
        });
        const lv = (await prisma.listingVariant.findFirst({ where: { listingId: listing.id, variantId: variant.id } }))
          ?? await prisma.listingVariant.create({ data: { listingId: listing.id, shopId, variantId: variant.id, sellerSku: `${pslug}-${s}`, mrpPaise: BigInt(mrp * 100), pricePaise: BigInt(Math.max(price, 50) * 100) } });
        const loc = (await prisma.inventoryLocation.findFirst({ where: { shopId } })) ?? await prisma.inventoryLocation.create({ data: { shopId, name: "Shop Floor" } });
        if (!(await prisma.stock.findFirst({ where: { locationId: loc.id, listingVariantId: lv.id } }))) {
          await prisma.stock.create({ data: { locationId: loc.id, listingVariantId: lv.id, quantityOnHand: 20 + made, quantityReserved: 0 } });
        }
      }
      made++;
    }
  }
  console.log(`✅ Rich seed: ${CATEGORIES.length} categories, ${SHOPS.length} shops, ${made} products (each in 2–4 shops with stock).`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
