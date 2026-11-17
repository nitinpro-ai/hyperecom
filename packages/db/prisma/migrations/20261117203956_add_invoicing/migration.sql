-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "seller_order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "series" TEXT NOT NULL,
    "seq_no" INTEGER NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "taxable_value_paise" BIGINT NOT NULL,
    "tax_total_paise" BIGINT NOT NULL,
    "grand_total_paise" BIGINT NOT NULL,
    "place_of_supply" TEXT,
    "irn" TEXT,
    "qr_payload" TEXT,
    "pdf_media_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" UUID NOT NULL,
    "invoice_id" UUID NOT NULL,
    "refund_id" UUID NOT NULL,
    "series" TEXT NOT NULL,
    "seq_no" INTEGER NOT NULL,
    "credit_note_no" TEXT NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "reason" TEXT,
    "irn" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoices_seller_order_id_key" ON "invoices"("seller_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

-- CreateIndex
CREATE INDEX "invoices_seller_id_idx" ON "invoices"("seller_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_series_seq_no_key" ON "invoices"("series", "seq_no");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_refund_id_key" ON "credit_notes"("refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_credit_note_no_key" ON "credit_notes"("credit_note_no");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_series_seq_no_key" ON "credit_notes"("series", "seq_no");

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
