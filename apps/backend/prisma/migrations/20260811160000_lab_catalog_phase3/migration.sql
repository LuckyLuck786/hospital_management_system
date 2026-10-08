-- LabTestCatalog (test catalog with reference ranges per gender)
CREATE TABLE "lab_test_catalog" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" TEXT,
    "sampleType" TEXT,
    "referenceRanges" JSONB NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "lab_test_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lab_test_catalog_hospitalId_code_key" ON "lab_test_catalog"("hospitalId", "code");
CREATE INDEX "lab_test_catalog_hospitalId_idx" ON "lab_test_catalog"("hospitalId");
CREATE INDEX "lab_test_catalog_category_idx" ON "lab_test_catalog"("category");

ALTER TABLE "lab_test_catalog" ADD CONSTRAINT "lab_test_catalog_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- LabOrder: link to patient (for patient-facing scoping)
ALTER TABLE "lab_orders" ADD COLUMN "patientId" TEXT;
ALTER TABLE "lab_orders" ADD CONSTRAINT "lab_orders_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "lab_orders_patientId_idx" ON "lab_orders"("patientId");

-- LabTest: link to catalog entry + carry unit/reference-range snapshot
ALTER TABLE "lab_tests" ADD COLUMN "catalogId" TEXT;
ALTER TABLE "lab_tests" ADD COLUMN "unit" TEXT;
ALTER TABLE "lab_tests" ADD COLUMN "referenceRanges" JSONB;
ALTER TABLE "lab_tests" ADD CONSTRAINT "lab_tests_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "lab_test_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "lab_tests_catalogId_idx" ON "lab_tests"("catalogId");
