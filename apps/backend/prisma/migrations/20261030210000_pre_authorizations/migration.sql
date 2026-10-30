-- Cashless pre-authorisation requests (insurer approves an estimate before treatment)
CREATE TABLE "pre_authorizations" (
    "id" TEXT NOT NULL,
    "requestNumber" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,
    "tpaName" TEXT,
    "policyNumber" TEXT NOT NULL,
    "treatment" TEXT NOT NULL,
    "estimatedAmount" DECIMAL(12,2) NOT NULL,
    "approvedAmount" DECIMAL(12,2),
    "status" "ClaimStatus" NOT NULL DEFAULT 'SUBMITTED',
    "validUntil" TIMESTAMP(3),
    "decisionNote" TEXT,
    "requestedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pre_authorizations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pre_authorizations_requestNumber_key" ON "pre_authorizations"("requestNumber");
CREATE INDEX "pre_authorizations_hospitalId_status_idx" ON "pre_authorizations"("hospitalId", "status");
CREATE INDEX "pre_authorizations_patientId_idx" ON "pre_authorizations"("patientId");
ALTER TABLE "pre_authorizations" ADD CONSTRAINT "pre_authorizations_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pre_authorizations" ADD CONSTRAINT "pre_authorizations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Claims can reference the pre-authorisation they settle
ALTER TABLE "insurance_claims" ADD COLUMN "preAuthorizationId" TEXT;
ALTER TABLE "insurance_claims" ADD CONSTRAINT "insurance_claims_preAuthorizationId_fkey" FOREIGN KEY ("preAuthorizationId") REFERENCES "pre_authorizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
