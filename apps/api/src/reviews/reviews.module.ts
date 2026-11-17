import { Module } from "@nestjs/common";
import { ReviewsService } from "./reviews.service";
import { AuthModule } from "../auth/auth.module";

/** M21 — Reviews. Owns reviews; recomputes product/shop rating aggregates exactly. */
@Module({ imports: [AuthModule], providers: [ReviewsService], exports: [ReviewsService] })
export class ReviewsModule {}
