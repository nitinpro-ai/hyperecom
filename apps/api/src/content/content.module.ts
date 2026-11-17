import { Module } from "@nestjs/common";
import { ContentService } from "./content.service";
import { AuthModule } from "../auth/auth.module";

/** M32 — Content CMS. Owns pages/banners/faqs. Admin CRUD + public read. */
@Module({ imports: [AuthModule], providers: [ContentService], exports: [ContentService] })
export class ContentModule {}
