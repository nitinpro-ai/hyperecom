import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { bannerActive } from "./content.core";

export interface PageInput {
  slug: string; cityId?: string; title: string; body: string;
  metaTitle?: string; metaDesc?: string; isPublished?: boolean; updatedBy?: string;
}

/**
 * M32 — Content CMS. Admin CRUD for pages/banners/FAQs; public reads return only
 * published pages, active-in-window banners, and active FAQs. Spec: PART II M32.
 */
@Injectable()
export class ContentService {
  // ---- pages (admin upsert by slug) ----
  async upsertPage(input: PageInput) {
    const p = await prisma.page.upsert({
      where: { slug: input.slug },
      update: { cityId: input.cityId ?? null, title: input.title, body: input.body, metaTitle: input.metaTitle ?? null, metaDesc: input.metaDesc ?? null, isPublished: input.isPublished ?? false, updatedBy: input.updatedBy ?? null },
      create: { slug: input.slug, cityId: input.cityId ?? null, title: input.title, body: input.body, metaTitle: input.metaTitle ?? null, metaDesc: input.metaDesc ?? null, isPublished: input.isPublished ?? false, updatedBy: input.updatedBy ?? null },
    });
    return { pageId: p.id };
  }

  /** Public: a published page by slug (null if absent/unpublished). */
  async publicPage(slug: string) {
    return prisma.page.findFirst({
      where: { slug, isPublished: true },
      select: { slug: true, cityId: true, title: true, body: true, metaTitle: true, metaDesc: true, updatedAt: true },
    });
  }

  // ---- banners ----
  async createBanner(input: { cityId?: string; title: string; imageMediaId?: string; linkUrl?: string; sortOrder?: number; activeFrom?: Date; activeTo?: Date }) {
    const b = await prisma.banner.create({
      data: { cityId: input.cityId ?? null, title: input.title, imageMediaId: input.imageMediaId ?? null, linkUrl: input.linkUrl ?? null, sortOrder: input.sortOrder ?? 0, activeFrom: input.activeFrom ?? null, activeTo: input.activeTo ?? null },
    });
    return { bannerId: b.id };
  }

  /** Public: active banners for a city (or global), filtered by window, sorted. */
  async publicBanners(cityId?: string, now = new Date()) {
    const rows = await prisma.banner.findMany({
      where: { isActive: true, OR: [{ cityId: null }, ...(cityId ? [{ cityId }] : [])] },
      orderBy: { sortOrder: "asc" },
    });
    return rows.filter((b) => bannerActive(b, now)).map((b) => ({ id: b.id, title: b.title, imageMediaId: b.imageMediaId, linkUrl: b.linkUrl }));
  }

  // ---- FAQs ----
  async createFaq(input: { category?: string; question: string; answer: string; sortOrder?: number }) {
    const f = await prisma.faq.create({ data: { category: input.category ?? "GENERAL", question: input.question, answer: input.answer, sortOrder: input.sortOrder ?? 0 } });
    return { faqId: f.id };
  }

  async publicFaqs(category?: string) {
    return prisma.faq.findMany({
      where: { isActive: true, ...(category ? { category } : {}) },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      select: { id: true, category: true, question: true, answer: true },
    });
  }
}
