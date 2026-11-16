import { Injectable } from "@nestjs/common";
import { prisma } from "@apnacity/db";
import { slaDueAt, freezesRefund, ticketNo, type Priority } from "../support/step14.core";

export interface OpenTicketInput {
  openedByUserId: string;
  type: string;
  subject: string;
  description?: string;
  orderId?: string;
  sellerOrderId?: string;
  priority?: Priority;
}

/**
 * M23 — Support & Disputes. Tickets with SLA-by-priority; an open dispute
 * freezes auto-refund flows (checked by M15/M19 before releasing a refund).
 */
@Injectable()
export class SupportService {
  async open(input: OpenTicketInput): Promise<{ ticketId: string; ticketNo: string }> {
    const priority = input.priority ?? "MEDIUM";
    const ticket = await prisma.$transaction(async (tx) => {
      const seq = await nextSeq(tx, "ticket_seq");
      return tx.supportTicket.create({
        data: {
          ticketNo: ticketNo(seq), openedByUserId: input.openedByUserId, type: input.type,
          subject: input.subject, description: input.description ?? null,
          orderId: input.orderId ?? null, sellerOrderId: input.sellerOrderId ?? null,
          priority, status: "OPEN", slaDueAt: slaDueAt(priority, new Date()),
        },
      });
    });
    return { ticketId: ticket.id, ticketNo: ticket.ticketNo };
  }

  async reply(ticketId: string, senderType: string, senderId: string | null, body: string) {
    await prisma.ticketMessage.create({ data: { ticketId, senderType, senderId, body } });
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: senderType === "AGENT" ? "AWAITING_CUSTOMER" : "IN_PROGRESS" } });
  }

  async resolve(ticketId: string, note: string) {
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: "RESOLVED", resolvedAt: new Date() } });
    await prisma.ticketMessage.create({ data: { ticketId, senderType: "AGENT", body: `Resolved: ${note}` } });
  }

  async escalate(ticketId: string) {
    await prisma.supportTicket.update({ where: { id: ticketId }, data: { status: "ESCALATED", priority: "URGENT", slaDueAt: slaDueAt("URGENT", new Date()) } });
  }

  /** Does an active dispute exist for this seller order → refunds must be frozen. */
  async refundFrozen(sellerOrderId: string): Promise<boolean> {
    const tickets = await prisma.supportTicket.findMany({ where: { sellerOrderId }, select: { type: true, status: true } });
    return tickets.some((t) => freezesRefund(t.type, t.status));
  }

  async listForUser(userId: string) {
    return prisma.supportTicket.findMany({ where: { openedByUserId: userId }, orderBy: { createdAt: "desc" } });
  }
}

async function nextSeq(tx: any, key: string): Promise<number> {
  const k = `${key}_${new Date().getUTCFullYear()}`;
  const row = await tx.systemCheck.upsert({ where: { key: k }, update: {}, create: { key: k, value: "0" } });
  const next = Number.parseInt(row.value ?? "0", 10) + 1;
  await tx.systemCheck.update({ where: { key: k }, data: { value: String(next) } });
  return next;
}
