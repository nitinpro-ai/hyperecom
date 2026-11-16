-- CreateTable
CREATE TABLE "return_requests" (
    "id" UUID NOT NULL,
    "seller_order_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" VARCHAR(15) NOT NULL,
    "comments" TEXT,
    "media_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "status" VARCHAR(17) NOT NULL DEFAULT 'REQUESTED',
    "refund_method" VARCHAR(6),
    "upi_id" TEXT,
    "requested_at" TIMESTAMPTZ(3),
    "window_expires_at" TIMESTAMPTZ(3),
    "refund_id" UUID,
    "resolution_note" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "return_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_templates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "channel" VARCHAR(8) NOT NULL,
    "locale" VARCHAR(2) NOT NULL DEFAULT 'EN',
    "body_template" TEXT NOT NULL,
    "dlt_template_id" TEXT,
    "whatsapp_template_name" TEXT,
    "variables" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "template_code" TEXT NOT NULL,
    "channel" VARCHAR(8) NOT NULL,
    "payload" JSONB,
    "status" VARCHAR(10) NOT NULL DEFAULT 'QUEUED',
    "sent_at" TIMESTAMPTZ(3),
    "error" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" UUID NOT NULL,
    "channel" VARCHAR(8) NOT NULL,
    "topic" VARCHAR(8) NOT NULL,
    "opted_in" BOOLEAN NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id","channel","topic")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" UUID NOT NULL,
    "ticket_no" TEXT NOT NULL,
    "opened_by_user_id" UUID NOT NULL,
    "type" VARCHAR(17) NOT NULL,
    "order_id" UUID,
    "seller_order_id" UUID,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "priority" VARCHAR(7) NOT NULL DEFAULT 'MEDIUM',
    "status" VARCHAR(18) NOT NULL DEFAULT 'OPEN',
    "assigned_to" UUID,
    "sla_due_at" TIMESTAMPTZ(3),
    "resolved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" UUID NOT NULL,
    "ticket_id" UUID NOT NULL,
    "sender_type" VARCHAR(8) NOT NULL,
    "sender_id" UUID,
    "body" TEXT,
    "media_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "return_requests_user_id_idx" ON "return_requests"("user_id");

-- CreateIndex
CREATE INDEX "return_requests_seller_order_id_idx" ON "return_requests"("seller_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_code_channel_locale_key" ON "notification_templates"("code", "channel", "locale");

-- CreateIndex
CREATE INDEX "notifications_user_id_idx" ON "notifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticket_no_key" ON "support_tickets"("ticket_no");

-- CreateIndex
CREATE INDEX "support_tickets_opened_by_user_id_idx" ON "support_tickets"("opened_by_user_id");

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
