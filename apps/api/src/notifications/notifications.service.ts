import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { decideSend, renderTemplate, type Channel, type Topic } from "../support/step14.core";

export interface SendInput {
  userId: string;
  templateCode: string;
  channel: Channel;
  topic: Topic;
  locale?: string;
  vars?: Record<string, string | number>;
  nowIstHour?: number;
}

export type SendResult = { status: "SENT" | "SUPPRESSED" | "FAILED"; reason?: string };

/**
 * M22 — Notifications gateway. Resolves template + preference, applies the
 * fail-closed/opt-out/quiet-hours gate (step14.core), records every attempt.
 * Actual channel delivery (DLT/FCM/WhatsApp/email) is a provider call stubbed
 * here; the record + gating is the deliverable.
 */
@Injectable()
export class NotificationsService {
  async send(input: SendInput): Promise<SendResult> {
    const tpl = await prisma.notificationTemplate.findFirst({
      where: { code: input.templateCode, channel: input.channel, locale: input.locale ?? "EN", isActive: true },
    });
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_channel_topic: { userId: input.userId, channel: input.channel, topic: input.topic } },
    });

    const decision = decideSend({
      channel: input.channel, topic: input.topic,
      dltTemplateId: tpl?.dltTemplateId, optedIn: pref?.optedIn ?? true,
      nowIstHour: input.nowIstHour ?? istHour(),
    });

    if (!decision.send) {
      await prisma.notification.create({
        data: { userId: input.userId, templateCode: input.templateCode, channel: input.channel, status: "SUPPRESSED", error: decision.reason, payload: input.vars ?? {} },
      });
      return { status: "SUPPRESSED", reason: decision.reason };
    }

    const body = tpl ? renderTemplate(tpl.bodyTemplate, input.vars ?? {}) : "";
    // provider delivery would happen here; we record SENT (dev)
    await prisma.notification.create({
      data: { userId: input.userId, templateCode: input.templateCode, channel: input.channel, status: "SENT", sentAt: new Date(), payload: { body, ...input.vars } },
    });
    return { status: "SENT" };
  }

  async setPreference(userId: string, channel: Channel, topic: Topic, optedIn: boolean) {
    await prisma.notificationPreference.upsert({
      where: { userId_channel_topic: { userId, channel, topic } },
      update: { optedIn }, create: { userId, channel, topic, optedIn },
    });
  }

  async list(userId: string) {
    return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 });
  }
}

function istHour(now = new Date()): number {
  // IST = UTC+5:30
  return new Date(now.getTime() + 5.5 * 3600e3).getUTCHours();
}
