import { Module } from "@nestjs/common";
import { ReturnsService } from "./returns.service";
import { AuthModule } from "../auth/auth.module";

/** M19 — Returns. Owns return_requests; emits return.approved.v1 → M17/M16. */
@Module({ imports: [AuthModule], providers: [ReturnsService], exports: [ReturnsService] })
export class ReturnsModule {}
