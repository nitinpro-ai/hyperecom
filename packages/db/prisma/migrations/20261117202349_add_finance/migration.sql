-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" UUID NOT NULL,
    "owner_type" VARCHAR(16) NOT NULL,
    "owner_id" UUID NOT NULL,
    "account_type" VARCHAR(16) NOT NULL,
    "balance_paise" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" UUID NOT NULL,
    "transaction_id" UUID NOT NULL,
    "ledger_account_id" UUID NOT NULL,
    "debit_paise" BIGINT NOT NULL DEFAULT 0,
    "credit_paise" BIGINT NOT NULL DEFAULT 0,
    "source_type" TEXT,
    "source_id" UUID,
    "memo" TEXT,
    "settlement_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "period_start" DATE,
    "period_end" DATE,
    "gross_sales_paise" BIGINT,
    "commission_paise" BIGINT,
    "delivery_paise" BIGINT,
    "refunds_paise" BIGINT,
    "tcs_paise" BIGINT,
    "adjustments_paise" BIGINT,
    "net_paise" BIGINT,
    "status" VARCHAR(10) NOT NULL DEFAULT 'PENDING',
    "provider_payout_ref" TEXT,
    "utr" TEXT,
    "paid_at" TIMESTAMPTZ(3),
    "statement_no" TEXT,
    "approved_by" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_items" (
    "id" UUID NOT NULL,
    "settlement_id" UUID NOT NULL,
    "seller_order_id" UUID NOT NULL,
    "amount_paise" BIGINT NOT NULL,
    "breakdown" JSONB,

    CONSTRAINT "settlement_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" UUID NOT NULL,
    "city_id" UUID,
    "category_id" UUID,
    "shop_id" UUID,
    "rate_bp" INTEGER NOT NULL,
    "valid_from" TIMESTAMPTZ(3),
    "valid_to" TIMESTAMPTZ(3),

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_owner_type_owner_id_account_type_key" ON "ledger_accounts"("owner_type", "owner_id", "account_type");

-- CreateIndex
CREATE INDEX "ledger_entries_transaction_id_idx" ON "ledger_entries"("transaction_id");

-- CreateIndex
CREATE INDEX "ledger_entries_ledger_account_id_idx" ON "ledger_entries"("ledger_account_id");

-- CreateIndex
CREATE UNIQUE INDEX "settlements_statement_no_key" ON "settlements"("statement_no");

-- CreateIndex
CREATE INDEX "settlements_seller_id_status_idx" ON "settlements"("seller_id", "status");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_ledger_account_id_fkey" FOREIGN KEY ("ledger_account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_items" ADD CONSTRAINT "settlement_items_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
