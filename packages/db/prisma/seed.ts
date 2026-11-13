import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Step 2 seed — M03 geography foundation.
 *
 * Loads:
 *   - India (country)
 *   - all 28 states + 8 union territories with official LGD codes
 *   - Bijnor (city in Uttar Pradesh) with center point, localities, a pincode,
 *     and one delivery zone (fee/ETA) — the pilot city (D-007).
 *
 * The full India Post pincode CSV (~19k rows) is a follow-up data-import task
 * (Tracking §7) — this seed loads exactly what the Step 2 Verify gate needs:
 * "migrations + seed run; Bijnor geo seeded".
 */

// India states + union territories — official LGD (Local Government Directory) codes.
const STATES: Array<{ code: string; name: string }> = [
  // 28 states
  { code: "AP", name: "Andhra Pradesh" },
  { code: "AR", name: "Arunachal Pradesh" },
  { code: "AS", name: "Assam" },
  { code: "BR", name: "Bihar" },
  { code: "CT", name: "Chhattisgarh" },
  { code: "GA", name: "Goa" },
  { code: "GJ", name: "Gujarat" },
  { code: "HR", name: "Haryana" },
  { code: "HP", name: "Himachal Pradesh" },
  { code: "JH", name: "Jharkhand" },
  { code: "KA", name: "Karnataka" },
  { code: "KL", name: "Kerala" },
  { code: "MP", name: "Madhya Pradesh" },
  { code: "MH", name: "Maharashtra" },
  { code: "MN", name: "Manipur" },
  { code: "ML", name: "Meghalaya" },
  { code: "MZ", name: "Mizoram" },
  { code: "NL", name: "Nagaland" },
  { code: "OR", name: "Odisha" },
  { code: "PB", name: "Punjab" },
  { code: "RJ", name: "Rajasthan" },
  { code: "SK", name: "Sikkim" },
  { code: "TN", name: "Tamil Nadu" },
  { code: "TG", name: "Telangana" },
  { code: "TR", name: "Tripura" },
  { code: "UP", name: "Uttar Pradesh" },
  { code: "UK", name: "Uttarakhand" },
  { code: "WB", name: "West Bengal" },
  // 8 union territories
  { code: "AN", name: "Andaman and Nicobar Islands" },
  { code: "CH", name: "Chandigarh" },
  { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "DL", name: "Delhi" },
  { code: "JK", name: "Jammu and Kashmir" },
  { code: "LA", name: "Ladakh" },
  { code: "LD", name: "Lakshadweep" },
  { code: "PY", name: "Puducherry" },
];

// Bijnor, Uttar Pradesh — pilot city (D-007). Center ~29.3724 N, 78.1360 E.
const BIJNOR = {
  slug: "bijnor",
  name: "Bijnor",
  lat: 29.3724,
  lng: 78.136,
  localities: [
    { slug: "civil-lines", name: "Civil Lines" },
    { slug: "mandi-chowk", name: "Mandi Chowk" },
    { slug: "nehru-nagar", name: "Nehru Nagar" },
  ],
  pincodes: ["246701"],
};

async function main() {
  // 1. Country
  const india = await prisma.country.upsert({
    where: { isoCode: "IN" },
    update: { name: "India", phoneCode: "+91" },
    create: { isoCode: "IN", name: "India", phoneCode: "+91" },
  });

  // 2. States + UTs
  for (const s of STATES) {
    await prisma.state.upsert({
      where: { countryId_code: { countryId: india.id, code: s.code } },
      update: { name: s.name },
      create: { countryId: india.id, code: s.code, name: s.name },
    });
  }
  const up = await prisma.state.findUniqueOrThrow({
    where: { countryId_code: { countryId: india.id, code: "UP" } },
  });

  // 3. Bijnor city (with PostGIS center point via raw SQL — geometry columns
  //    can't be set through the typed client).
  const city = await prisma.city.upsert({
    where: { slug: BIJNOR.slug },
    update: { name: BIJNOR.name, stateId: up.id },
    create: { slug: BIJNOR.slug, name: BIJNOR.name, stateId: up.id },
  });
  await prisma.$executeRaw`
    UPDATE cities SET center = ST_SetSRID(ST_MakePoint(${BIJNOR.lng}, ${BIJNOR.lat}), 4326)
    WHERE id = ${city.id}::uuid`;

  // 4. Localities
  for (const l of BIJNOR.localities) {
    await prisma.locality.upsert({
      where: { cityId_slug: { cityId: city.id, slug: l.slug } },
      update: { name: l.name },
      create: { cityId: city.id, slug: l.slug, name: l.name },
    });
  }

  // 5. Pincodes
  for (const p of BIJNOR.pincodes) {
    await prisma.pincode.upsert({
      where: { pincode: p },
      update: { cityId: city.id, isServiceable: true },
      create: { cityId: city.id, pincode: p, isServiceable: true },
    });
  }

  // 6. One delivery zone (CIRCLE_RADIUS 8 km, ₹30 flat, free above ₹499, ETA 30–75 min)
  const existingZone = await prisma.deliveryZone.findFirst({
    where: { cityId: city.id, name: "Bijnor City (8km)" },
  });
  if (!existingZone) {
    const zone = await prisma.deliveryZone.create({
      data: {
        cityId: city.id,
        name: "Bijnor City (8km)",
        zoneType: "CIRCLE_RADIUS",
        radiusM: 8000,
        feePaise: 3000n,
        freeAbovePaise: 49900n,
        etaMinMinutes: 30,
        etaMaxMinutes: 75,
      },
    });
    await prisma.$executeRaw`
      UPDATE delivery_zones SET center = ST_SetSRID(ST_MakePoint(${BIJNOR.lng}, ${BIJNOR.lat}), 4326)
      WHERE id = ${zone.id}::uuid`;
  }

  await prisma.systemCheck.upsert({
    where: { key: "geo_seed" },
    update: { value: new Date().toISOString() },
    create: { key: "geo_seed", value: new Date().toISOString() },
  });

  const counts = {
    countries: await prisma.country.count(),
    states: await prisma.state.count(),
    cities: await prisma.city.count(),
    localities: await prisma.locality.count(),
    pincodes: await prisma.pincode.count(),
    deliveryZones: await prisma.deliveryZone.count(),
  };
  console.log("✅ Geography seed complete:", JSON.stringify(counts));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
