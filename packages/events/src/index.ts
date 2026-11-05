/**
 * Domain event contracts — the ONLY coupling allowed between modules (D-015).
 * Naming: `aggregate.action.vN`. Payloads are versioned; never mutate a
 * published shape — add a new version instead.
 *
 * Consumers must be idempotent (dedupe on eventId) — see M27 outbox.
 */

export interface DomainEvent<P> {
  eventId: string;            // uuid — dedupe key
  eventType: string;          // e.g. "order.placed.v1"
  aggregateType: string;      // e.g. "order"
  aggregateId: string;        // uuid of the aggregate root
  payload: P;
  occurredAt: string;         // ISO-8601 UTC
}

export const EventTypes = {
  // identity & tenancy
  UserRegistered: "user.registered.v1",
  KycSubmitted: "kyc.submitted.v1",
  KycApproved: "kyc.approved.v1",
  ShopCreated: "shop.created.v1",
  ShopUpdated: "shop.updated.v1",
  ShopSuspended: "shop.suspended.v1",

  // catalogue
  ProductCreated: "product.created.v1",
  ProductMerged: "product.merged.v1",
  ListingPublished: "listing.published.v1",
  ListingUpdated: "listing.updated.v1",
  ListingPaused: "listing.paused.v1",

  // inventory
  StockLow: "stock.low.v1",
  StockOut: "stock.out.v1",
  StockReconciled: "stock.reconciled.v1",

  // orders & payments
  OrderPlaced: "order.placed.v1",
  OrderChildAccepted: "order.child.accepted.v1",
  OrderChildRejected: "order.child.rejected.v1",
  OrderCancelled: "order.cancelled.v1",
  PaymentCaptured: "payment.captured.v1",
  PaymentFailed: "payment.failed.v1",
  RefundCompleted: "refund.completed.v1",

  // delivery & returns
  DeliveryAssigned: "delivery.assigned.v1",
  DeliveryDelivered: "delivery.delivered.v1",
  DeliveryFailed: "delivery.failed.v1",
  ReturnApproved: "return.approved.v1",

  // finance
  SettlementPaid: "settlement.paid.v1",

  // media
  MediaProcessed: "media.processed.v1",
} as const;

export type EventType = (typeof EventTypes)[keyof typeof EventTypes];
