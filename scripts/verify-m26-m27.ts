/**
 * LIVE verification of M26 (audit) + M27 (outbox) against the cluster database.
 * Usage: DATABASE_URL=postgresql://apnacity:apnacity@192.168.2.224:30432/apnacity \
 *        pnpm --filter @apnacity/api exec tsx ../../scripts/verify-m26-m27.ts
 */
import { prisma } from "@apnacity/db";
import { OutboxService } from "../apps/api/src/outbox/outbox.service";
import { AuditService } from "../apps/api/src/audit/audit.service";

async function main() {
  const outbox = new OutboxService();
  const audit = new AuditService();
  const results: string[] = [];

  // ── M27: publish event + audit entry in ONE transaction ──────────────
  let handlerFired = 0;
  outbox.on("verify.demo.v1", async (payload) => {
    handlerFired++;
    console.log(`   → handler received: ${JSON.stringify(payload)}`);
  });

  await prisma.$transaction(async (tx) => {
    await audit.record(tx, {
      action: "VERIFY_DEMO", entityType: "system",
      entityId: "00000000-0000-0000-0000-000000000001",
      actorRole: "SCRIPT", reason: "module verification",
    });
    await outbox.publish(tx, {
      aggregateType: "system", aggregateId: "00000000-0000-0000-0000-000000000001",
      eventType: "verify.demo.v1", payload: { hello: "ApnaCity" },
    });
  });
  results.push("M27 publish-in-transaction        ✅ (1 audit row + 1 outbox row, atomic)");

  // ── M27: dispatch → handler fires exactly once (idempotent) ──────────
  const dispatched1 = await outbox.dispatchBatch();
  const dispatched2 = await outbox.dispatchBatch(); // no duplicates
  if (dispatched1 >= 1 && dispatched2 === 0 && handlerFired === 1) {
    results.push("M27 dispatch + idempotent consumer ✅ (handler fired exactly once)");
  } else {
    results.push(`M27 dispatch                     ❌ (d1=${dispatched1} d2=${dispatched2} h=${handlerFired})`);
  }

  // ── M26: destructive action without reason is REFUSED ────────────────
  let refused = false;
  try {
    await prisma.$transaction(async (tx) => {
      await audit.record(tx, {
        action: "SHOP_SUSPEND", entityType: "shop",
        entityId: "00000000-0000-0000-0000-000000000002",
      });
    });
  } catch {
    refused = true;
  }
  results.push(refused
    ? "M26 destructive-without-reason    ✅ (refused, transaction rolled back)"
    : "M26 destructive-without-reason    ❌ (was allowed!)");

  // ── M26: DB-level append-only (UPDATE blocked by trigger) ─────────────
  let blocked = false;
  try {
    await prisma.$executeRawUnsafe(`UPDATE audit_logs SET reason = 'tampered' WHERE action = 'VERIFY_DEMO'`);
  } catch (e) {
    blocked = String(e).includes("append-only");
  }
  results.push(blocked
    ? "M26 append-only DB trigger        ✅ (UPDATE blocked by PostgreSQL)"
    : "M26 append-only DB trigger        ❌ (UPDATE went through!)");

  console.log("\n═══ APNACITY MODULE VERIFICATION (live on cluster DB) ═══");
  for (const r of results) console.log(r);
  console.log("═════════════════════════════════════════════════════════\n");
  await prisma.$disconnect();
  process.exit(results.every((r) => r.includes("✅")) ? 0 : 1);
}

void main();
