import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { prisma } from "@apnacity/db";
import { MediaService } from "./media.service";
import { JwtAuthGuard, CurrentUser } from "../auth/auth.guard";
import type { AccessClaims } from "../auth/auth.crypto";
import { storageKey as buildKey, type MediaKind } from "./media.core";

interface UploadUrlDto {
  kind: MediaKind;
  mime: string;
  sizeBytes: number;
  shopId?: string;
}

interface UploadBase64Dto {
  kind?: MediaKind;
  mime: string;
  dataBase64: string;
  filename?: string;
  shopId?: string;
}

/** M10 — media upload lifecycle + direct browser upload & public image serving. */
@Controller("media")
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Post("upload-url")
  @UseGuards(JwtAuthGuard)
  async uploadUrl(@CurrentUser() user: AccessClaims, @Body() dto: UploadUrlDto) {
    const r = await this.media.requestUploadUrl({ ownerUserId: user.sub, ...dto });
    if (!r.ok) throw new HttpException(r.reason, 400);
    return { mediaId: r.mediaId, uploadUrl: r.uploadUrl, expiresInSec: r.expiresInSec };
  }

  /**
   * Direct browser upload for Seller Studio (`<input type="file" accept="image/*">`).
   * Stores the binary payload in PostgreSQL (`media.variants.dataBase64`) so all
   * API replicas serve the image immediately at GET /v1/media/raw/:id without a shared PVC.
   */
  @Post("upload-base64")
  @UseGuards(JwtAuthGuard)
  async uploadBase64(@CurrentUser() user: AccessClaims, @Body() dto: UploadBase64Dto) {
    const kind: MediaKind = dto.kind ?? "PRODUCT_IMAGE";
    const mime = (dto.mime || "image/jpeg").toLowerCase();
    if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mime)) {
      throw new HttpException("UNSUPPORTED_MIME: Please upload a JPG, PNG, or WebP image.", 400);
    }
    const cleanB64 = (dto.dataBase64 || "").replace(/^data:[^;]+;base64,/, "").trim();
    if (!cleanB64) throw new HttpException("EMPTY_FILE", 400);
    const buf = Buffer.from(cleanB64, "base64");
    if (buf.byteLength === 0 || buf.byteLength > 8 * 1024 * 1024) {
      throw new HttpException("FILE_TOO_LARGE: Max 8 MB per image.", 400);
    }

    const row = await prisma.media.create({
      data: {
        ownerUserId: user.sub,
        shopId: dto.shopId ?? null,
        kind,
        mime,
        sizeBytes: buf.byteLength,
        storageKey: "",
        scanStatus: "CLEAN",
        variants: {
          dataBase64: cleanB64,
          mime,
          filename: dto.filename ?? "product-image",
        },
      },
    });
    const key = buildKey(kind, row.id, mime);
    await prisma.media.update({ where: { id: row.id }, data: { storageKey: key } });

    const base = (process.env.API_BASE_URL ?? "http://192.168.2.224:30400").replace(/\/+$/, "");
    const url = `${base}/v1/media/raw/${row.id}`;
    return { mediaId: row.id, url, mime, sizeBytes: buf.byteLength };
  }

  /** Public binary image endpoint (no JWT required so <img> tags in any browser work). */
  @Get("raw/:id")
  async raw(@Param("id") id: string, @Res() res: Response) {
    const row = await prisma.media.findUnique({ where: { id } });
    const variants = (row?.variants ?? null) as { dataBase64?: string; mime?: string } | null;
    if (!row || !variants?.dataBase64) {
      res.status(404).json({ message: "media not found" });
      return;
    }
    const buf = Buffer.from(variants.dataBase64, "base64");
    res.setHeader("Content-Type", variants.mime || row.mime || "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.status(200).send(buf);
  }

  @Post(":id/complete")
  @UseGuards(JwtAuthGuard)
  async complete(@Param("id") id: string) {
    const r = await this.media.complete(id);
    if (!r.ok) {
      const code = r.reason === "NOT_FOUND" ? 404 : r.reason === "MIME_SPOOF" ? 415 : 409;
      throw new HttpException(r.reason, code);
    }
    return { mediaId: r.mediaId, variants: r.variants };
  }

  @Get(":id")
  @UseGuards(JwtAuthGuard)
  async get(@Param("id") id: string) {
    const m = await this.media.get(id);
    if (!m) throw new HttpException("media not found", 404);
    return m;
  }
}
