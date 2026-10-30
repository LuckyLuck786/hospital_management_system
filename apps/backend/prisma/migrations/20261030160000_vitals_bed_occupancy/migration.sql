-- Bed occupancy per room (ward management, admin occupancy KPIs)
ALTER TABLE "rooms" ADD COLUMN "occupiedBeds" INTEGER NOT NULL DEFAULT 0;

-- Nurse-recorded vital signs (triage / ward rounds)
CREATE TABLE "vital_signs" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "systolic" INTEGER,
    "diastolic" INTEGER,
    "pulse" INTEGER,
    "temperature" DECIMAL(4,1),
    "spo2" INTEGER,
    "respiratoryRate" INTEGER,
    "height" DECIMAL(5,2),
    "weight" DECIMAL(5,2),
    "bmi" DECIMAL(4,2),
    "notes" TEXT,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vital_signs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "vital_signs_hospitalId_idx" ON "vital_signs"("hospitalId");
CREATE INDEX "vital_signs_patientId_recordedAt_idx" ON "vital_signs"("patientId", "recordedAt");
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vital_signs" ADD CONSTRAINT "vital_signs_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
