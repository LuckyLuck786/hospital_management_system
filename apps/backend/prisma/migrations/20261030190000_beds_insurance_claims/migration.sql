-- Individual beds (patient-level bed assignment)
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE');

CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "patientId" TEXT,
    "admittedAt" TIMESTAMP(3),
    "admissionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "beds_patientId_key" ON "beds"("patientId");
CREATE UNIQUE INDEX "beds_roomId_label_key" ON "beds"("roomId", "label");
CREATE INDEX "beds_hospitalId_idx" ON "beds"("hospitalId");
ALTER TABLE "beds" ADD CONSTRAINT "beds_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "beds" ADD CONSTRAINT "beds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "beds" ADD CONSTRAINT "beds_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: one bed per unit of room capacity; the first N beds keep the room's existing occupied count
INSERT INTO "beds" ("id", "hospitalId", "roomId", "label", "status", "updatedAt")
SELECT gen_random_uuid()::text, r."hospitalId", r."id", 'Bed ' || n,
       CASE WHEN n <= r."occupiedBeds" THEN 'OCCUPIED'::"BedStatus" ELSE 'AVAILABLE'::"BedStatus" END,
       CURRENT_TIMESTAMP
FROM "rooms" r CROSS JOIN LATERAL generate_series(1, r."capacity") AS n;

-- Insurance / TPA claims
CREATE TYPE "ClaimStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'SETTLED');

CREATE TABLE "insurance_claims" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "tpaName" TEXT,
    "policyNumber" TEXT NOT NULL,
    "claimedAmount" DECIMAL(12,2) NOT NULL,
    "approvedAmount" DECIMAL(12,2),
    "status" "ClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "decisionNote" TEXT,
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "insurance_claims_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "insurance_claims_claimNumber_key" ON "insurance_claims"("claimNumber");
CREATE INDEX "insurance_claims_hospitalId_status_idx" ON "insurance_claims"("hospitalId", "status");
CREATE INDEX "insurance_claims_invoiceId_idx" ON "insurance_claims"("invoiceId");
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
