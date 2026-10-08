-- Phase 5: notifications & payments
-- 1) New notification type for the nightly medicine-expiry scan
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MEDICINE_EXPIRY_ALERT';

-- 2) Razorpay order / payment tracking on invoices
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "razorpayOrderId" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "razorpayPaymentId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_razorpayOrderId_key" ON "invoices"("razorpayOrderId") WHERE "razorpayOrderId" IS NOT NULL;
