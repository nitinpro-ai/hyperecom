import { describe, expect, it, afterAll } from "vitest";
import { prisma } from "@apnacity/db";
import { ContentService } from "./content.service";

/**
 * M32 integration (live DB): page publish gate, active banner window, FAQ read.
 */
const RUN = !!process.env.DATABASE_URL;
const d = RUN ? describe : describe.skip;
const TAG = "zz-m32";

d("M32 content CMS (integration)", () => {
  const content = new ContentService();

  afterAll(async () => {
    await prisma.page.deleteMany({ where: { slug: { startsWith: TAG } } });
    await prisma.banner.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.faq.deleteMany({ where: { question: { startsWith: TAG } } });
    await prisma.$disconnect();
  });

  it("unpublished page is NOT publicly readable; published one is", async () => {
    await content.upsertPage({ slug: `${TAG}-draft`, title: "Draft", body: "x", isPublished: false });
    expect(await content.publicPage(`${TAG}-draft`)).toBeNull();

    await content.upsertPage({ slug: `${TAG}-live`, title: "Bijnor", body: "Welcome", isPublished: true });
    const pub = await content.publicPage(`${TAG}-live`);
    expect(pub?.title).toBe("Bijnor");
  });

  it("public banners respect the active window", async () => {
    await content.createBanner({ title: `${TAG}-current`, activeFrom: new Date(Date.now() - 86400e3), activeTo: new Date(Date.now() + 86400e3) });
    await content.createBanner({ title: `${TAG}-expired`, activeTo: new Date(Date.now() - 1000) });
    const banners = await content.publicBanners();
    const titles = banners.map((b) => b.title);
    expect(titles).toContain(`${TAG}-current`);
    expect(titles).not.toContain(`${TAG}-expired`);
  });

  it("public FAQs return active entries", async () => {
    await content.createFaq({ category: "ORDERS", question: `${TAG}-how to track?`, answer: "Open the order." });
    const faqs = await content.publicFaqs("ORDERS");
    expect(faqs.some((f) => f.question === `${TAG}-how to track?`)).toBe(true);
  });
});
