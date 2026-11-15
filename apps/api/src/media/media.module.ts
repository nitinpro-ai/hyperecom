import { Module } from "@nestjs/common";
import { MediaService, STORAGE_PORT } from "./media.service";
import { MediaController } from "./media.controller";
import { DiskStoragePort } from "./disk-storage.port";
import { S3StoragePort } from "./s3-storage.port";
import type { StoragePort } from "./storage.port";
import { AuthModule } from "../auth/auth.module";

/**
 * M10 — Media. Owns the `media` table (D-015). Imports AuthModule for the JWT
 * guard.
 *
 * Storage backend is chosen by MEDIA_STORAGE_DRIVER (packages/config):
 *   "disk" (default, dev)  → DiskStoragePort — real file storage, NO S3 needed.
 *   "s3"   (prod/staging)  → S3StoragePort  — AWS S3 / Cloudflare R2 / MinIO.
 *
 * To enable S3: set MEDIA_STORAGE_DRIVER=s3 and the S3_* env vars (see
 * .env.example "MEDIA / STORAGE" block). Both adapters implement StoragePort
 * and have zero extra dependencies (SigV4 via node:crypto).
 */
const storageProvider = {
  provide: STORAGE_PORT,
  useFactory: (): StoragePort =>
    (process.env.MEDIA_STORAGE_DRIVER ?? "disk") === "s3"
      ? new S3StoragePort()
      : new DiskStoragePort(),
};

@Module({
  imports: [AuthModule],
  controllers: [MediaController],
  providers: [MediaService, storageProvider],
  exports: [MediaService],
})
export class MediaModule {}
