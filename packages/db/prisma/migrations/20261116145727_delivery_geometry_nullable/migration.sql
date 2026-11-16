-- AlterTable
ALTER TABLE "delivery_jobs" ALTER COLUMN "pickup_location" DROP NOT NULL,
ALTER COLUMN "drop_location" DROP NOT NULL;
