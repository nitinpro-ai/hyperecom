import { Module } from "@nestjs/common";
import { SupportService } from "./support.service";
import { AuthModule } from "../auth/auth.module";

/** M23 — Support & Disputes. Owns support_tickets/ticket_messages; dispute freeze. */
@Module({ imports: [AuthModule], providers: [SupportService], exports: [SupportService] })
export class SupportModule {}
