import { Module } from "@nestjs/common";
import { NotificationsService } from "./notifications.service";
import { AuthModule } from "../auth/auth.module";

/** M22 — Notifications. Owns notification_templates/notifications/preferences. */
@Module({ imports: [AuthModule], providers: [NotificationsService], exports: [NotificationsService] })
export class NotificationsModule {}
