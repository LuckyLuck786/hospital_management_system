-- Family-history risk flags on the patient profile (PRD 7.3)
ALTER TABLE "patients" ADD COLUMN "familyHistoryDiabetes" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "familyHistoryHypertension" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "familyHistoryCancer" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "familyHistoryCardiac" BOOLEAN NOT NULL DEFAULT false;

-- Vaccination history (PRD 7.3)
CREATE TABLE "vaccinations" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "vaccineName" TEXT NOT NULL,
    "doseNumber" INTEGER,
    "administeredOn" DATE NOT NULL,
    "batchNumber" TEXT,
    "nextDueDate" DATE,
    "recordedById" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vaccinations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vaccinations_hospitalId_idx" ON "vaccinations"("hospitalId");
CREATE INDEX "vaccinations_patientId_idx" ON "vaccinations"("patientId");
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vaccinations" ADD CONSTRAINT "vaccinations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A patient cannot hold two active appointments in the same slot, across any doctor (PRD 7.2).
-- Partial index, same reasoning as appointments_active_slot_idx.
-- Skipped (with a notice) if existing data already holds such duplicates, so deploys never fail;
-- the service-level pre-check in AppointmentsService still applies in that case.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "appointments"
    WHERE "status" NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED')
    GROUP BY "patientId", "scheduledDate", "scheduledTime"
    HAVING count(*) > 1
  ) THEN
    CREATE UNIQUE INDEX "appointments_patient_active_slot_idx"
    ON "appointments" ("patientId", "scheduledDate", "scheduledTime")
    WHERE "status" NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED');
  ELSE
    RAISE NOTICE 'appointments_patient_active_slot_idx not created: duplicate active patient slots exist';
  END IF;
END $$;
