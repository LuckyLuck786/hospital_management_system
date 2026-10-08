-- Prevent double-booking of the same doctor slot at the database level.
-- Concurrent inserts for the same (doctorId, scheduledDate, scheduledTime)
-- will race; the unique index guarantees only one PENDING/CONFIRMED/IN_PROGRESS/
-- EMERGENCY appointment can occupy a slot. CANCELLED / NO_SHOW / COMPLETED
-- appointments free the slot for rebooking.
--
-- Note: this index is expressed in raw SQL (Prisma cannot model partial
-- indexes). If `prisma migrate dev` later reports drift, ignore it or run
-- `prisma migrate dev --create-only` and reconcile manually — do NOT drop it.

CREATE UNIQUE INDEX "appointments_active_slot_idx"
ON "appointments" ("doctorId", "scheduledDate", "scheduledTime")
WHERE "status" NOT IN ('CANCELLED', 'NO_SHOW', 'COMPLETED');
