import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { MediaService } from "./media.service";
import { JwtAuthGuard, CurrentUser } from "../auth/auth.guard";
import type { AccessClaims } from "../auth/auth.crypto";
import type { MediaKind } from "./media.core";

interface UploadUrlDto {
  kind: MediaKind;
  mime: string;
  sizeBytes: number;
  shopId?: string;
}

/** M10 — media upload lifecycle. All routes require a valid access token. */
@Controller("media")
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(@Inject(MediaService) private readonly media: MediaService) {}

  @Post("upload-url")
  async uploadUrl(@CurrentUser() user: AccessClaims, @Body() dto: UploadUrlDto) {
    const r = await this.media.requestUploadUrl({ ownerUserId: user.sub, ...dto });
    if (!r.ok) throw new HttpException(r.reason, 400);
    return { mediaId: r.mediaId, uploadUrl: r.uploadUrl, expiresInSec: r.expiresInSec };
  }

  @Post(":id/complete")
  async complete(@Param("id") id: string) {
    const r = await this.media.complete(id);
    if (!r.ok) {
      const code = r.reason === "NOT_FOUND" ? 404 : r.reason === "MIME_SPOOF" ? 415 : 409;
      throw new HttpException(r.reason, code);
    }
    return { mediaId: r.mediaId, variants: r.variants };
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const m = await this.media.get(id);
    if (!m) throw new HttpException("media not found", 404);
    return m;
  }
}
