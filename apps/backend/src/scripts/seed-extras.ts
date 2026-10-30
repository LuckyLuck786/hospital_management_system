/**
 * Idempotent demo data for wards, vitals and vaccinations, plus readable staff names.
 * Safe to run repeatedly and against an already-seeded database:
 *   local:   npx ts-node src/scripts/seed-extras.ts
 *   deployed: node dist/scripts/seed-extras.js
 */
import { PrismaClient } from '@prisma/client';

const STAFF_NAMES: Record<string, [string, string]> = {
  'superadmin@medcore.com': ['Aarav', 'Kapoor'],
  'admin@medcore.com': ['Meera', 'Iyer'],
  'nurse@medcore.com': ['Anita', 'Desai'],
  'reception@medcore.com': ['Rohit', 'Menon'],
  'labtech@medcore.com': ['Farhan', 'Qureshi'],
  'pharmacist@medcore.com': ['Kavya', 'Reddy'],
  'accountant@medcore.com': ['Vivek', 'Joshi'],
};

const ROOM_PLAN: Array<{ dept: string; rooms: Array<[string, string, number]> }> = [
  { dept: 'Cardiology', rooms: [['CCU-1', 'ICU', 4], ['C-201', 'Semi-private', 2], ['C-202', 'General Ward', 6]] },
  { dept: 'Orthopedics', rooms: [['O-101', 'General Ward', 8], ['O-102', 'Private', 1]] },
  { dept: 'Pediatrics', rooms: [['P-301', 'Paediatric Ward', 6], ['NICU', 'ICU', 4]] },
  { dept: 'Neurology', rooms: [['N-401', 'HDU', 3], ['N-402', 'General Ward', 6]] },
  { dept: 'General Medicine', rooms: [['G-001', 'General Ward', 10], ['G-002', 'Day Care', 6]] },
  { dept: 'Dermatology', rooms: [['D-501', 'Day Care', 4]] },
];

const VACCINES: Array<[string, number, number | null]> = [
  // name, dose, months until next dose (null = none)
  ['Hepatitis B', 1, 1],
  ['Hepatitis B', 2, 5],
  ['Tetanus-diphtheria (Td)', 1, 120],
  ['Influenza (seasonal)', 1, 12],
  ['COVID-19 booster', 3, null],
  ['Typhoid conjugate', 1, 36],
];

const rand = (min: number, max: number) => Math.round(min + Math.random() * (max - min));

export async function seedExtras(prisma: PrismaClient) {
  for (const [email, [firstName, lastName]] of Object.entries(STAFF_NAMES)) {
    await prisma.user.updateMany({ where: { email }, data: { firstName, lastName } });
  }

  const hospitals = await prisma.hospital.findMany({ select: { id: true, name: true } });
  for (const h of hospitals) {
    // Wards & beds
    if ((await prisma.room.count({ where: { hospitalId: h.id } })) === 0) {
      const depts = await prisma.department.findMany({ where: { hospitalId: h.id }, select: { id: true, name: true } });
      for (const plan of ROOM_PLAN) {
        const dept = depts.find((d) => d.name === plan.dept);
        if (!dept) continue;
        for (const [roomNumber, type, capacity] of plan.rooms) {
          const occupiedBeds = Math.min(capacity, rand(Math.floor(capacity * 0.3), capacity));
          await prisma.room.create({
            data: {
              hospitalId: h.id,
              departmentId: dept.id,
              roomNumber,
              type,
              capacity,
              occupiedBeds,
              isOccupied: occupiedBeds > 0,
              beds: {
                create: Array.from({ length: capacity }, (_, i) => ({
                  hospitalId: h.id,
                  label: `Bed ${i + 1}`,
                  status: i < occupiedBeds ? ('OCCUPIED' as const) : ('AVAILABLE' as const),
                })),
              },
            },
          });
        }
      }
    }

    // Put real patients into occupied beds that have nobody assigned (e.g. beds back-filled by migration)
    const unassigned = await prisma.bed.findMany({ where: { hospitalId: h.id, status: 'OCCUPIED', patientId: null }, orderBy: { label: 'asc' } });
    if (unassigned.length) {
      // Only ~40% of patients are inpatients; leftover occupied beds become free
      const total = await prisma.patient.count({ where: { hospitalId: h.id, deletedAt: null } });
      const admitted = await prisma.bed.count({ where: { hospitalId: h.id, patientId: { not: null } } });
      const free = (await prisma.patient.findMany({ where: { hospitalId: h.id, deletedAt: null, bed: null }, select: { id: true } })).slice(
        0,
        Math.max(0, Math.ceil(total * 0.4) - admitted),
      );
      const reasons = ['Post-operative observation', 'Pneumonia — IV antibiotics', 'Uncontrolled diabetes', 'Fracture, awaiting surgery', 'Dengue fever monitoring', 'Chest pain under evaluation'];
      for (const [i, bed] of unassigned.entries()) {
        const p = free[i];
        await prisma.bed.update({
          where: { id: bed.id },
          data: p
            ? { patientId: p.id, admittedAt: new Date(Date.now() - rand(1, 96) * 3600 * 1000), admissionNotes: reasons[i % reasons.length] }
            : { status: 'AVAILABLE' },
        });
      }
      for (const room of await prisma.room.findMany({ where: { hospitalId: h.id }, select: { id: true } })) {
        const n = await prisma.bed.count({ where: { roomId: room.id, status: 'OCCUPIED' } });
        await prisma.room.update({ where: { id: room.id }, data: { occupiedBeds: n, isOccupied: n > 0 } });
      }
    }

    // Insurance / TPA claims in various stages (no settlements, so invoices stay untouched)
    const filer = await prisma.user.findFirst({ where: { hospitalId: h.id, role: { in: ['ACCOUNTANT', 'RECEPTIONIST', 'HOSPITAL_ADMIN'] } }, select: { id: true } });
    if (filer && (await prisma.insuranceClaim.count({ where: { hospitalId: h.id } })) === 0) {
      const unpaid = await prisma.invoice.findMany({ where: { hospitalId: h.id, status: 'FINALIZED' }, orderBy: { createdAt: 'desc' }, take: 5 });
      const plans: Array<[string, string | null, string, string | null, number | null]> = [
        ['Star Health', 'MediAssist', 'SUBMITTED', null, null],
        ['HDFC ERGO', 'Paramount Health', 'UNDER_REVIEW', null, null],
        ['ICICI Lombard', null, 'APPROVED', null, 1],
        ['Niva Bupa', 'Vidal Health', 'PARTIALLY_APPROVED', 'Consumables not covered under policy', 0.7],
        ['Care Health', 'FHPL', 'REJECTED', 'Waiting period for this condition has not ended', 0],
      ];
      const base = await prisma.insuranceClaim.count();
      for (const [i, inv] of unpaid.entries()) {
        const [insurer, tpaName, status, decisionNote, ratio] = plans[i % plans.length];
        const policyNumber = `${insurer.split(' ')[0].toUpperCase()}-${rand(100000, 999999)}`;
        const claimed = Number(inv.balanceAmount);
        await prisma.insuranceClaim.create({
          data: {
            claimNumber: `CLM-${new Date().getFullYear()}-${String(base + i + 1).padStart(5, '0')}`,
            hospitalId: h.id,
            invoiceId: inv.id,
            patientId: inv.patientId,
            insurer,
            tpaName,
            policyNumber,
            claimedAmount: claimed,
            approvedAmount: ratio == null ? null : Math.round(claimed * ratio),
            status: status as any,
            decisionNote,
            submittedById: filer.id,
            reviewedById: ratio == null && status === 'SUBMITTED' ? null : filer.id,
            submittedAt: new Date(Date.now() - (i + 1) * 2 * 24 * 3600 * 1000),
            decidedAt: ratio == null ? null : new Date(Date.now() - i * 24 * 3600 * 1000),
          },
        });
        await prisma.patient.update({ where: { id: inv.patientId }, data: { insuranceProvider: insurer, insurancePolicyNumber: policyNumber } });
      }
    }

    const nurse = await prisma.user.findFirst({ where: { hospitalId: h.id, role: 'NURSE' }, select: { id: true } });
    const recorder = nurse ?? (await prisma.user.findFirst({ where: { hospitalId: h.id, role: 'DOCTOR' }, select: { id: true } }));
    if (!recorder) continue;

    const patients = await prisma.patient.findMany({ where: { hospitalId: h.id, deletedAt: null }, select: { id: true }, take: 30 });
    for (const [idx, p] of patients.entries()) {
      // Vitals: a few weeks of observations per patient
      if ((await prisma.vitalSign.count({ where: { patientId: p.id } })) === 0) {
        const height = rand(150, 185);
        const baseWeight = rand(52, 92);
        const hypertensive = idx % 4 === 0;
        const points = 4 + (idx % 4);
        for (let i = points - 1; i >= 0; i--) {
          const weight = baseWeight + rand(-2, 2);
          const recordedAt = new Date(Date.now() - i * 4 * 24 * 3600 * 1000 - rand(0, 8) * 3600 * 1000);
          await prisma.vitalSign.create({
            data: {
              hospitalId: h.id,
              patientId: p.id,
              systolic: hypertensive ? rand(138, 156) : rand(108, 128),
              diastolic: hypertensive ? rand(88, 98) : rand(68, 84),
              pulse: rand(62, 96),
              temperature: Math.round((97.8 + Math.random() * 1.6) * 10) / 10,
              spo2: rand(95, 99),
              respiratoryRate: rand(14, 19),
              height,
              weight,
              bmi: Math.round((weight / Math.pow(height / 100, 2)) * 100) / 100,
              notes: i === 0 && hypertensive ? 'BP elevated — advised low-salt diet, recheck in 2 weeks' : null,
              recordedById: recorder.id,
              recordedAt,
            },
          });
        }
      }

      // Vaccinations
      if ((await prisma.vaccination.count({ where: { patientId: p.id } })) === 0) {
        const picks = VACCINES.filter((_, i) => (i + idx) % 2 === 0);
        for (const [i, [vaccineName, doseNumber, nextMonths]] of picks.entries()) {
          const administeredOn = new Date(Date.now() - (picks.length - i) * 75 * 24 * 3600 * 1000);
          const nextDueDate = nextMonths ? new Date(administeredOn.getTime() + nextMonths * 30 * 24 * 3600 * 1000) : null;
          await prisma.vaccination.create({
            data: {
              hospitalId: h.id,
              patientId: p.id,
              vaccineName,
              doseNumber,
              administeredOn,
              nextDueDate,
              batchNumber: `${vaccineName.slice(0, 3).toUpperCase()}-${rand(1000, 9999)}`,
              recordedById: recorder.id,
            },
          });
        }
        // family-history flags for a realistic spread
        await prisma.patient.update({
          where: { id: p.id },
          data: {
            familyHistoryDiabetes: idx % 3 === 0,
            familyHistoryHypertension: idx % 4 === 0,
            familyHistoryCardiac: idx % 5 === 0,
            familyHistoryCancer: idx % 7 === 0,
          },
        });
      }
    }
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedExtras(prisma)
    .then(() => console.log('✅ Extras seeded: wards, vitals, vaccinations, staff names'))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
