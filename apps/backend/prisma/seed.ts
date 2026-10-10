import { PrismaClient, UserRole, Gender, BloodGroup, AppointmentStatus, PaymentMethod, LabOrderStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const HOSPITAL_EMAILS = ['admin@medcore.hospital', 'city@medcore.hospital'];

async function upsertUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  hospitalId?: string;
  gender?: Gender;
  bloodGroup?: BloodGroup;
  dateOfBirth?: Date;
  phone?: string;
  isEmailVerified?: boolean;
  isActive?: boolean;
}) {
  return prisma.user.upsert({
    where: { email: data.email },
    update: {
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role,
      hospitalId: data.hospitalId,
      isEmailVerified: data.isEmailVerified ?? true,
      isActive: data.isActive ?? true,
      gender: data.gender,
      bloodGroup: data.bloodGroup,
      dateOfBirth: data.dateOfBirth,
      phone: data.phone,
    },
    create: data,
  });
}

async function main() {
  console.log('🌱 Seeding MedCore HMS...');

  // Idempotency guard. This seed runs on every boot (the root "start" script
  // chains db:seed before start:prod), and the transactional block below uses
  // create(...) — so re-running would append another two weeks of appointments,
  // invoices and lab orders on every restart. Skip if the DB already has data;
  // set SEED_RESET=1 to intentionally wipe the generated demo data and rebuild.
  if (process.env.SEED_RESET === '1') {
    console.log('♻️  SEED_RESET=1 — clearing generated demo data before reseeding...');
    await prisma.payment.deleteMany();
    await prisma.invoiceItem.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.labResult.deleteMany();
    await prisma.labTest.deleteMany();
    await prisma.labOrder.deleteMany();
    await prisma.prescriptionItem.deleteMany();
    await prisma.prescription.deleteMany();
    await prisma.medicalRecordAttachment.deleteMany();
    await prisma.medicalRecord.deleteMany();
    await prisma.appointment.deleteMany();
  } else {
    const existingAppointments = await prisma.appointment.count();
    if (existingAppointments > 0) {
      console.log(
        `⏭️  Already seeded (${existingAppointments} appointments present) — skipping. Set SEED_RESET=1 to rebuild.`,
      );
      return;
    }
  }

  // ══════════════════════════════════════════════════════════
  // 1. HOSPITALS
  // ══════════════════════════════════════════════════════════
  const hospitalsData = [
    {
      email: 'admin@medcore.hospital',
      name: 'MedCore General Hospital',
      phone: '+91-9876543210',
      reg: 'REG-2024-001',
      street: '123 Healthcare Avenue, Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      zip: '400050',
    },
    {
      email: 'city@medcore.hospital',
      name: 'MedCore City Hospital',
      phone: '+91-9822011223',
      reg: 'REG-2024-002',
      street: '45 Wellness Road, Koregaon Park',
      city: 'Pune',
      state: 'Maharashtra',
      zip: '411001',
    },
  ];

  const hospitals: any[] = [];
  for (const h of hospitalsData) {
    const hospital = await prisma.hospital.upsert({
      where: { email: h.email },
      update: {
        phone: h.phone,
        registrationNumber: h.reg,
        isVerified: true,
        address: {
          upsert: {
            update: { street: h.street, city: h.city, state: h.state, zipCode: h.zip, country: 'India' },
            create: { street: h.street, city: h.city, state: h.state, zipCode: h.zip, country: 'India' },
          },
        },
      },
      create: {
        name: h.name,
        email: h.email,
        phone: h.phone,
        registrationNumber: h.reg,
        isVerified: true,
        address: {
          create: { street: h.street, city: h.city, state: h.state, zipCode: h.zip, country: 'India' },
        },
      },
    });
    hospitals.push(hospital);
    console.log(`🏥 ${hospital.name} ready`);
  }
  const [hospital, cityHospital] = hospitals;

  // ══════════════════════════════════════════════════════════
  // 2. DEPARTMENTS
  // ══════════════════════════════════════════════════════════
  const deptDefs = [
    { name: 'Cardiology', code: 'CARD', desc: 'Heart and cardiovascular care' },
    { name: 'Orthopedics', code: 'ORTHO', desc: 'Bone and joint care' },
    { name: 'Pediatrics', code: 'PEDS', desc: 'Child healthcare' },
    { name: 'General Medicine', code: 'GEN', desc: 'Primary healthcare' },
    { name: 'Neurology', code: 'NEURO', desc: 'Brain and nervous system' },
    { name: 'Dermatology', code: 'DERMA', desc: 'Skin care' },
  ];

  const departmentsByHospital: any = {};
  for (const hp of hospitals) {
    const deps = [];
    for (const d of deptDefs) {
      const dept = await prisma.department.upsert({
        where: { hospitalId_name: { hospitalId: hp.id, name: d.name } },
        update: { code: d.code, description: d.desc },
        create: { name: d.name, code: d.code, description: d.desc, hospitalId: hp.id },
      });
      deps.push(dept);
    }
    departmentsByHospital[hp.id] = deps;
  }
  console.log(`🏥 Departments seeded for ${hospitals.length} hospitals`);

  // ══════════════════════════════════════════════════════════
  // 3. USERS (super admin + hospital admins)
  // ══════════════════════════════════════════════════════════
  await upsertUser({
    email: 'superadmin@medcore.com',
    password: await bcrypt.hash('SuperAdmin@123', 12),
    firstName: 'Super',
    lastName: 'Admin',
    role: UserRole.SUPER_ADMIN,
    isEmailVerified: true,
    isActive: true,
  });

  await upsertUser({
    email: 'admin@medcore.com',
    password: await bcrypt.hash('Admin@123', 12),
    firstName: 'Hospital',
    lastName: 'Admin',
    role: UserRole.HOSPITAL_ADMIN,
    hospitalId: hospital.id,
    isEmailVerified: true,
    isActive: true,
  });

  await upsertUser({
    email: 'admin2@medcore.com',
    password: await bcrypt.hash('Admin@123', 12),
    firstName: 'City',
    lastName: 'Admin',
    role: UserRole.HOSPITAL_ADMIN,
    hospitalId: cityHospital.id,
    isEmailVerified: true,
    isActive: true,
  });

  // ══════════════════════════════════════════════════════════
  // 4. DOCTORS (8 across both hospitals)
  // ══════════════════════════════════════════════════════════
  const doctorData = [
    { name: 'Dr. Rajesh Sharma', spec: 'Cardiology', dept: 'Cardiology', fee: 800, exp: 15, qual: 'MBBS, MD, DM (Cardiology)', hospital: 0 },
    { name: 'Dr. Priya Patel', spec: 'Orthopedics', dept: 'Orthopedics', fee: 700, exp: 12, qual: 'MBBS, MS (Ortho)', hospital: 0 },
    { name: 'Dr. Amit Kumar', spec: 'Pediatrics', dept: 'Pediatrics', fee: 600, exp: 10, qual: 'MBBS, MD (Pediatrics)', hospital: 0 },
    { name: 'Dr. Sunita Gupta', spec: 'General Medicine', dept: 'General Medicine', fee: 500, exp: 8, qual: 'MBBS, MD (General Medicine)', hospital: 0 },
    { name: 'Dr. Vikram Rao', spec: 'Neurology', dept: 'Neurology', fee: 900, exp: 14, qual: 'MBBS, MD, DM (Neurology)', hospital: 0 },
    { name: 'Dr. Neha Singh', spec: 'Dermatology', dept: 'Dermatology', fee: 650, exp: 9, qual: 'MBBS, MD (Dermatology)', hospital: 0 },
    { name: 'Dr. Arjun Mehta', spec: 'Cardiology', dept: 'Cardiology', fee: 850, exp: 11, qual: 'MBBS, MD, DM (Cardiology)', hospital: 1 },
    { name: 'Dr. Kavita Joshi', spec: 'Pediatrics', dept: 'Pediatrics', fee: 550, exp: 7, qual: 'MBBS, DCH', hospital: 1 },
  ];

  const scheduleTemplate = {
    monday: [{ start: '09:00', end: '13:00', slotDuration: 30 }, { start: '14:00', end: '17:00', slotDuration: 30 }],
    tuesday: [{ start: '09:00', end: '13:00', slotDuration: 30 }, { start: '14:00', end: '17:00', slotDuration: 30 }],
    wednesday: [{ start: '09:00', end: '13:00', slotDuration: 30 }, { start: '14:00', end: '17:00', slotDuration: 30 }],
    thursday: [{ start: '09:00', end: '13:00', slotDuration: 30 }, { start: '14:00', end: '17:00', slotDuration: 30 }],
    friday: [{ start: '09:00', end: '13:00', slotDuration: 30 }, { start: '14:00', end: '17:00', slotDuration: 30 }],
    saturday: [{ start: '09:00', end: '13:00', slotDuration: 30 }],
  };

  const doctors: any[] = [];
  for (const doc of doctorData) {
    const hp = hospitals[doc.hospital];
    const dept = departmentsByHospital[hp.id].find((d: any) => d.name === doc.dept);
    const [firstName, ...rest] = doc.name.split(' ');
    const lastName = rest.join(' ');
    const slug = `${firstName.toLowerCase().replace('dr.', 'dr')}.${lastName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')}`;
    const email = `${slug}@medcore.com`;
    const user = await upsertUser({
      email,
      password: await bcrypt.hash('Doctor@123', 12),
      firstName,
      lastName,
      role: UserRole.DOCTOR,
      hospitalId: hp.id,
      isEmailVerified: true,
      isActive: true,
      gender: Gender.MALE,
    });
    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {
        hospitalId: hp.id,
        departmentId: dept.id,
        specialization: doc.spec,
        qualification: doc.qual,
        experienceYears: doc.exp,
        consultationFee: doc.fee,
        weeklySchedule: scheduleTemplate,
      },
      create: {
        userId: user.id,
        hospitalId: hp.id,
        departmentId: dept.id,
        specialization: doc.spec,
        qualification: doc.qual,
        experienceYears: doc.exp,
        consultationFee: doc.fee,
        weeklySchedule: scheduleTemplate,
      },
    });
    doctors.push(doctor);
  }
  console.log(`👨‍⚕️ ${doctors.length} doctors seeded`);

  // ══════════════════════════════════════════════════════════
  // 5. PATIENTS (30, realistic Indian names)
  // ══════════════════════════════════════════════════════════
  const patientNames: Array<[string, string, Gender, BloodGroup]> = [
    ['Rahul', 'Verma', Gender.MALE, BloodGroup.O_POSITIVE],
    ['Anita', 'Desai', Gender.FEMALE, BloodGroup.A_POSITIVE],
    ['Vikram', 'Rao', Gender.MALE, BloodGroup.B_POSITIVE],
    ['Neha', 'Singh', Gender.FEMALE, BloodGroup.AB_POSITIVE],
    ['Kiran', 'Mehta', Gender.MALE, BloodGroup.O_NEGATIVE],
    ['Pooja', 'Shah', Gender.FEMALE, BloodGroup.B_NEGATIVE],
    ['Arjun', 'Nair', Gender.MALE, BloodGroup.A_NEGATIVE],
    ['Deepa', 'Iyer', Gender.FEMALE, BloodGroup.O_POSITIVE],
    ['Sanjay', 'Kulkarni', Gender.MALE, BloodGroup.A_POSITIVE],
    ['Ritu', 'Agarwal', Gender.FEMALE, BloodGroup.B_POSITIVE],
    ['Mohammed', 'Khan', Gender.MALE, BloodGroup.O_POSITIVE],
    ['Sneha', 'Reddy', Gender.FEMALE, BloodGroup.AB_NEGATIVE],
    ['Amit', 'Bose', Gender.MALE, BloodGroup.A_NEGATIVE],
    ['Lakshmi', 'Menon', Gender.FEMALE, BloodGroup.O_NEGATIVE],
    ['Rohan', 'Chopra', Gender.MALE, BloodGroup.B_POSITIVE],
    ['Priyanka', 'Das', Gender.FEMALE, BloodGroup.A_POSITIVE],
    ['Suresh', 'Patil', Gender.MALE, BloodGroup.O_POSITIVE],
    ['Kavya', 'Saxena', Gender.FEMALE, BloodGroup.B_NEGATIVE],
    ['Nikhil', 'Gandhi', Gender.MALE, BloodGroup.AB_POSITIVE],
    ['Meera', 'Krishnan', Gender.FEMALE, BloodGroup.O_POSITIVE],
    ['Aditya', 'Roy', Gender.MALE, BloodGroup.A_POSITIVE],
    ['Farah', 'Ali', Gender.FEMALE, BloodGroup.B_POSITIVE],
    ['Gaurav', 'Shukla', Gender.MALE, BloodGroup.O_NEGATIVE],
    ['Ishita', 'Banerjee', Gender.FEMALE, BloodGroup.A_NEGATIVE],
    ['Ravi', 'Teja', Gender.MALE, BloodGroup.O_POSITIVE],
    ['Divya', 'Pillai', Gender.FEMALE, BloodGroup.AB_NEGATIVE],
    ['Harsha', 'Vardhan', Gender.MALE, BloodGroup.B_NEGATIVE],
    ['Tanvi', 'Mishra', Gender.FEMALE, BloodGroup.A_POSITIVE],
    ['Kunal', 'Sabharwal', Gender.MALE, BloodGroup.O_POSITIVE],
    ['Shreya', 'Ghosal', Gender.FEMALE, BloodGroup.B_POSITIVE],
  ];

  const patients: any[] = [];
  for (let i = 0; i < patientNames.length; i++) {
    const [firstName, lastName, gender, blood] = patientNames[i];
    const hp = hospitals[i % 2];
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`;
    const user = await upsertUser({
      email,
      password: await bcrypt.hash('Patient@123', 12),
      firstName,
      lastName,
      role: UserRole.PATIENT,
      hospitalId: hp.id,
      isEmailVerified: true,
      isActive: true,
      gender,
      bloodGroup: blood,
      dateOfBirth: new Date(1970 + (i % 40), i % 12, (i % 28) + 1),
      phone: `+91-9${Math.floor(Math.random() * 900000000 + 100000000)}`,
    });
    const patient = await prisma.patient.upsert({
      where: { userId: user.id },
      update: {
        hospitalId: hp.id,
        emergencyContactName: 'Family Member',
        emergencyContactPhone: `+91-9${Math.floor(Math.random() * 900000000 + 100000000)}`,
        allergies: i % 4 === 0 ? 'Penicillin' : i % 7 === 0 ? 'Dust, Pollen' : null,
      },
      create: {
        userId: user.id,
        hospitalId: hp.id,
        patientId: `PAT-${new Date().getFullYear()}-${String(i + 1).padStart(4, '0')}`,
        emergencyContactName: 'Family Member',
        emergencyContactPhone: `+91-9${Math.floor(Math.random() * 900000000 + 100000000)}`,
        allergies: i % 4 === 0 ? 'Penicillin' : null,
      },
    });
    patients.push(patient);
  }
  console.log(`🧑‍⚕️ ${patients.length} patients seeded`);

  // ══════════════════════════════════════════════════════════
  // 6. STAFF (all remaining roles)
  // ══════════════════════════════════════════════════════════
  const staff = [
    { email: 'reception@medcore.com', pass: 'Reception@123', first: 'Reception', last: 'Desk', role: UserRole.RECEPTIONIST },
    { email: 'nurse@medcore.com', pass: 'Nurse@123', first: 'Head', last: 'Nurse', role: UserRole.NURSE },
    { email: 'labtech@medcore.com', pass: 'LabTech@123', first: 'Lab', last: 'Technician', role: UserRole.LAB_TECHNICIAN },
    { email: 'pharmacist@medcore.com', pass: 'Pharma@123', first: 'Chief', last: 'Pharmacist', role: UserRole.PHARMACIST },
    { email: 'accountant@medcore.com', pass: 'Accountant@123', first: 'Senior', last: 'Accountant', role: UserRole.ACCOUNTANT },
  ];

  for (const s of staff) {
    const user = await upsertUser({
      email: s.email,
      password: await bcrypt.hash(s.pass, 12),
      firstName: s.first,
      lastName: s.last,
      role: s.role,
      hospitalId: hospital.id,
      isEmailVerified: true,
      isActive: true,
    });
    const profile = { userId: user.id, hospitalId: hospital.id };
    switch (s.role) {
      case UserRole.RECEPTIONIST:
        await prisma.receptionist.upsert({ where: { userId: user.id }, update: profile, create: profile });
        break;
      case UserRole.NURSE:
        await prisma.nurse.upsert({ where: { userId: user.id }, update: { ...profile, departmentId: departmentsByHospital[hospital.id][3].id }, create: { ...profile, departmentId: departmentsByHospital[hospital.id][3].id } });
        break;
      case UserRole.LAB_TECHNICIAN:
        await prisma.labTechnician.upsert({ where: { userId: user.id }, update: { ...profile, specialization: 'Pathology' }, create: { ...profile, specialization: 'Pathology' } });
        break;
      case UserRole.PHARMACIST:
        await prisma.pharmacist.upsert({ where: { userId: user.id }, update: { ...profile, licenseNumber: 'MH-PH-45231' }, create: { ...profile, licenseNumber: 'MH-PH-45231' } });
        break;
      case UserRole.ACCOUNTANT:
        await prisma.accountant.upsert({ where: { userId: user.id }, update: profile, create: profile });
        break;
    }
  }
  console.log('👩‍💼 Staff roles seeded');

  // ══════════════════════════════════════════════════════════
  // 7. MEDICINES + BATCHES
  // ══════════════════════════════════════════════════════════
  const medicineDefs = [
    { name: 'Paracetamol 500mg', generic: 'Paracetamol', form: 'TABLET', mfr: 'Cipla', price: 2.5, mrp: 3, reorder: 100, qty: 480, expiry: 18 },
    { name: 'Amoxicillin 250mg', generic: 'Amoxicillin', form: 'CAPSULE', mfr: 'Sun Pharma', price: 4.2, mrp: 5, reorder: 80, qty: 240, expiry: 14 },
    { name: 'Azithromycin 500mg', generic: 'Azithromycin', form: 'TABLET', mfr: 'Cipla', price: 12, mrp: 14, reorder: 60, qty: 120, expiry: 16 },
    { name: 'Omeprazole 20mg', generic: 'Omeprazole', form: 'CAPSULE', mfr: 'Dr. Reddy\'s', price: 3.5, mrp: 4.5, reorder: 90, qty: 300, expiry: 20 },
    { name: 'Metformin 500mg', generic: 'Metformin', form: 'TABLET', mfr: 'USV', price: 2.8, mrp: 3.5, reorder: 120, qty: 520, expiry: 22 },
    { name: 'Amlodipine 5mg', generic: 'Amlodipine', form: 'TABLET', mfr: 'Torrent', price: 3.2, mrp: 4, reorder: 80, qty: 260, expiry: 15 },
    { name: 'Atorvastatin 10mg', generic: 'Atorvastatin', form: 'TABLET', mfr: 'Zydus', price: 5.5, mrp: 6.5, reorder: 70, qty: 210, expiry: 19 },
    { name: 'Cetirizine 10mg', generic: 'Cetirizine', form: 'TABLET', mfr: 'Mankind', price: 1.5, mrp: 2, reorder: 100, qty: 340, expiry: 17 },
    { name: 'Ibuprofen 400mg', generic: 'Ibuprofen', form: 'TABLET', mfr: 'Lupin', price: 2.2, mrp: 3, reorder: 90, qty: 280, expiry: 13 },
    { name: 'Insulin Glargine', generic: 'Insulin Glargine', form: 'INJECTION', mfr: 'Sanofi', price: 480, mrp: 520, reorder: 20, qty: 40, expiry: 12 },
    { name: 'Salbutamol Inhaler', generic: 'Salbutamol', form: 'INHALER', mfr: 'Cipla', price: 95, mrp: 110, reorder: 25, qty: 55, expiry: 16 },
    { name: 'Paracetamol Syrup', generic: 'Paracetamol', form: 'SYRUP', mfr: 'Micro Labs', price: 45, mrp: 52, reorder: 30, qty: 70, expiry: 14 },
    { name: 'Dolo 650', generic: 'Paracetamol', form: 'TABLET', mfr: 'Micro Labs', price: 15, mrp: 18, reorder: 150, qty: 8, expiry: 21 },
    { name: 'Vitamin D3 60K', generic: 'Cholecalciferol', form: 'CAPSULE', mfr: 'Abbott', price: 22, mrp: 26, reorder: 50, qty: 130, expiry: 24 },
    { name: 'ORS Sachet', generic: 'Oral Rehydration Salts', form: 'POWDER', mfr: 'FDC', price: 8, mrp: 10, reorder: 200, qty: 600, expiry: 30 },
  ];

  const medicines: any[] = [];
  for (const m of medicineDefs) {
    const medicine = await prisma.medicine.upsert({
      where: { id: `seed-med-${m.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}` },
      update: {
        genericName: m.generic,
        form: m.form,
        manufacturer: m.mfr,
        unitPrice: m.price,
        mrp: m.mrp,
        reorderLevel: m.reorder,
        isActive: true,
      },
      create: {
        id: `seed-med-${m.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`,
        hospitalId: hospital.id,
        name: m.name,
        genericName: m.generic,
        form: m.form,
        manufacturer: m.mfr,
        category: m.form === 'TABLET' || m.form === 'CAPSULE' ? 'Oral' : m.form === 'INJECTION' ? 'Injectables' : 'Other',
        unitPrice: m.price,
        mrp: m.mrp,
        reorderLevel: m.reorder,
      },
    });

    const batchNumber = `B${new Date().getFullYear()}${String(medicines.length + 1).padStart(3, '0')}`;
    await prisma.medicineBatch.upsert({
      where: { medicineId_batchNumber: { medicineId: medicine.id, batchNumber } },
      update: { quantity: m.qty },
      create: {
        medicineId: medicine.id,
        batchNumber,
        manufacturingDate: new Date(Date.now() - 6 * 30 * 24 * 3600 * 1000),
        expiryDate: new Date(Date.now() + m.expiry * 30 * 24 * 3600 * 1000),
        quantity: m.qty,
        unitCost: m.price * 0.7,
        mrp: m.mrp,
        supplier: m.mfr,
      },
    });

    // One expired + quarantined batch for Paracetamol 500mg to demo expiry handling
    if (m.name === 'Paracetamol 500mg') {
      await prisma.medicineBatch.upsert({
        where: { medicineId_batchNumber: { medicineId: medicine.id, batchNumber: 'B2023-OLD' } },
        update: { isExpired: true, isQuarantined: true },
        create: {
          medicineId: medicine.id,
          batchNumber: 'B2023-OLD',
          manufacturingDate: new Date('2023-06-01'),
          expiryDate: new Date('2025-06-01'),
          quantity: 25,
          unitCost: 1.5,
          mrp: 3,
          supplier: m.mfr,
          isExpired: true,
          isQuarantined: true,
        },
      });
    }
    medicines.push(medicine);
  }
  console.log(`💊 ${medicines.length} medicines seeded with batches`);

  // ══════════════════════════════════════════════════════════
  // 7b. LAB TEST CATALOG (reference ranges per gender)
  // ══════════════════════════════════════════════════════════
  const labCatalog = [
    { code: 'HB', name: 'Haemoglobin', category: 'Hematology', unit: 'g/dL', sampleType: 'Blood', price: 100, ranges: { MALE: { min: 13.0, max: 17.5 }, FEMALE: { min: 12.0, max: 16.0 } } },
    { code: 'WBC', name: 'Total Leukocyte Count', category: 'Hematology', unit: 'x10³/µL', sampleType: 'Blood', price: 120, ranges: { min: 4000, max: 11000 } },
    { code: 'PLT', name: 'Platelet Count', category: 'Hematology', unit: 'x10³/µL', sampleType: 'Blood', price: 120, ranges: { min: 150000, max: 450000 } },
    { code: 'ESR', name: 'Erythrocyte Sedimentation Rate', category: 'Hematology', unit: 'mm/hr', sampleType: 'Blood', price: 110, ranges: { MALE: { min: 0, max: 15 }, FEMALE: { min: 0, max: 20 } } },
    { code: 'FBS', name: 'Blood Sugar (Fasting)', category: 'Biochemistry', unit: 'mg/dL', sampleType: 'Blood', price: 150, ranges: { min: 70, max: 110 } },
    { code: 'PPBS', name: 'Blood Sugar (Post Prandial)', category: 'Biochemistry', unit: 'mg/dL', sampleType: 'Blood', price: 150, ranges: { min: 100, max: 160 } },
    { code: 'HBA1C', name: 'Glycated Haemoglobin (HbA1c)', category: 'Biochemistry', unit: '%', sampleType: 'Blood', price: 250, ranges: { min: 4.0, max: 5.6 } },
    { code: 'TSH', name: 'Thyroid Stimulating Hormone', category: 'Endocrinology', unit: 'µIU/mL', sampleType: 'Blood', price: 220, ranges: { min: 0.4, max: 4.5 } },
    { code: 'TC', name: 'Total Cholesterol', category: 'Biochemistry', unit: 'mg/dL', sampleType: 'Blood', price: 180, ranges: { max: 200 } },
    { code: 'LDL', name: 'LDL Cholesterol', category: 'Biochemistry', unit: 'mg/dL', sampleType: 'Blood', price: 200, ranges: { max: 100 } },
    { code: 'SGPT', name: 'Alanine Transaminase (SGPT)', category: 'Biochemistry', unit: 'U/L', sampleType: 'Blood', price: 160, ranges: { min: 7, max: 56 } },
    { code: 'CREAT', name: 'Serum Creatinine', category: 'Biochemistry', unit: 'mg/dL', sampleType: 'Blood', price: 140, ranges: { MALE: { min: 0.7, max: 1.3 }, FEMALE: { min: 0.6, max: 1.1 } } },
    { code: 'CRP', name: 'C-Reactive Protein', category: 'Immunology', unit: 'mg/L', sampleType: 'Blood', price: 300, ranges: { max: 6 } },
    { code: 'UR', name: 'Urine Routine', category: 'Urinalysis', unit: '', sampleType: 'Urine', price: 100, ranges: 'Negative' },
  ];

  for (const t of labCatalog) {
    await prisma.labTestCatalog.upsert({
      where: { hospitalId_code: { hospitalId: hospital.id, code: t.code } },
      update: {
        name: t.name,
        category: t.category,
        unit: t.unit,
        sampleType: t.sampleType,
        referenceRanges: t.ranges,
        price: t.price,
        isActive: true,
      },
      create: {
        hospitalId: hospital.id,
        name: t.name,
        code: t.code,
        category: t.category,
        unit: t.unit,
        sampleType: t.sampleType,
        referenceRanges: t.ranges,
        price: t.price,
      },
    });
  }
  console.log(`🧪 ${labCatalog.length} lab tests seeded in catalog`);

  // ══════════════════════════════════════════════════════════
  // 8. APPOINTMENTS — 2 weeks of history + upcoming
  // ══════════════════════════════════════════════════════════
  // Reset demo appointments/records/invoices so the seed is deterministic
  const demoHospitalIds = hospitals.map((h) => h.id);
  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { invoice: { hospitalId: { in: demoHospitalIds } } } }),
    prisma.invoiceItem.deleteMany({ where: { invoice: { hospitalId: { in: demoHospitalIds } } } }),
    prisma.invoice.deleteMany({ where: { hospitalId: { in: demoHospitalIds } } }),
    prisma.labResult.deleteMany({ where: { labOrder: { hospitalId: { in: demoHospitalIds } } } }),
    prisma.labTest.deleteMany({ where: { labOrder: { hospitalId: { in: demoHospitalIds } } } }),
    prisma.labOrder.deleteMany({ where: { hospitalId: { in: demoHospitalIds } } }),
    prisma.prescriptionItem.deleteMany({ where: { prescription: { hospitalId: { in: demoHospitalIds } } } }),
    prisma.prescription.deleteMany({ where: { hospitalId: { in: demoHospitalIds } } }),
    prisma.medicalRecordAttachment.deleteMany({ where: { medicalRecord: { hospitalId: { in: demoHospitalIds } } } }),
    prisma.medicalRecord.deleteMany({ where: { hospitalId: { in: demoHospitalIds } } }),
    prisma.notification.deleteMany({ where: { hospitalId: { in: demoHospitalIds } } }),
    prisma.appointment.deleteMany({ where: { hospitalId: { in: demoHospitalIds } } }),
  ]);
  console.log('🗑️  Cleared previous demo appointments/records/invoices');

  // Clean up stale demo users created by earlier seed versions (emails with spaces)
  const stale = await prisma.user.deleteMany({
    where: {
      email: { contains: ' ' },
      OR: [{ role: UserRole.DOCTOR }, { role: UserRole.PATIENT }],
    },
  });
  if (stale.count > 0) console.log(`🧹 Removed ${stale.count} stale demo users`);

  const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30'];
  const statuses: AppointmentStatus[] = [AppointmentStatus.COMPLETED, AppointmentStatus.COMPLETED, AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW, AppointmentStatus.CANCELLED];

  let appointmentSeq = 0;
  let recordSeq = 0;
  let prescriptionSeq = 0;
  let invoiceSeq = 0;

  const reasons = ['Fever and body ache', 'Chest pain', 'Routine check-up', 'Persistent headache', 'Skin rash', 'Knee pain', 'Cough and cold', 'Diabetes follow-up', 'High blood pressure', 'Stomach pain'];
  const diagnoses = ['Viral fever', 'Hypertension', 'Type 2 Diabetes Mellitus', 'Migraine', 'Acute gastritis', 'Osteoarthritis', 'Allergic rhinitis', 'Bronchitis', 'Contact dermatitis', 'GERD'];
  const icdCodes = ['J11.1', 'I10', 'E11.9', 'G43.9', 'K29.7', 'M17.9', 'J30.4', 'J20.9', 'L23.9', 'K21.9'];
  const plans = ['Rest, hydration, and paracetamol as needed', 'Prescribed antihypertensive; low-salt diet; review in 2 weeks', 'Metformin started; dietary counselling; HbA1c in 3 months', 'Sumatriptan on onset; sleep hygiene counselling', 'Antacids and dietary changes; avoid spicy food', 'Physiotherapy and NSAIDs for 2 weeks', 'Antihistamines; avoid allergen exposure', 'Antibiotics and steam inhalation; review in 5 days', 'Topical steroid for 7 days; moisturiser', 'PPI before meals for 4 weeks'];

  const usedSlots = new Set<string>();

  for (let dayOffset = -14; dayOffset <= 2; dayOffset++) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + dayOffset);
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (dayName === 'sunday') continue;

    // 2–4 appointments per doctor per day
    for (const doctor of doctors) {
      const count = 2 + Math.floor(Math.random() * 3);
      const shuffled = [...timeSlots].sort(() => Math.random() - 0.5);
      for (let i = 0; i < count && i < shuffled.length; i++) {
        const time = shuffled[i];
        const slotKey = `${doctor.id}|${date.toISOString().split('T')[0]}|${time}`;
        if (usedSlots.has(slotKey)) continue;
        usedSlots.add(slotKey);

        // Keep each appointment inside the doctor's own hospital so a patient's
        // records never land under a different tenant (which the tenant-isolation
        // checks would then forbid the patient from opening).
        const hospitalPatients = patients.filter((p) => p.hospitalId === doctor.hospitalId);
        const patient =
          hospitalPatients[Math.floor(Math.random() * hospitalPatients.length)] || patients[0];
        const isPast = dayOffset < 0;
        const isToday = dayOffset === 0;
        const status: AppointmentStatus = isPast
          ? statuses[Math.floor(Math.random() * statuses.length)]
          : isToday
            ? [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS][Math.floor(Math.random() * 3)]
            : AppointmentStatus.CONFIRMED;

        appointmentSeq++;
        const appointment = await prisma.appointment.create({
          data: {
            appointmentNumber: `APT-${date.getFullYear()}-${String(appointmentSeq).padStart(5, '0')}`,
            hospitalId: doctor.hospitalId,
            doctorId: doctor.id,
            patientId: patient.id,
            departmentId: doctor.departmentId,
            scheduledDate: date,
            scheduledTime: time,
            duration: 30,
            status,
            reason: reasons[Math.floor(Math.random() * reasons.length)],
            isEmergency: Math.random() < 0.05,
          },
        });

        // Past, non-cancelled appointments get records, prescriptions, invoices, lab orders
        if (isPast && status === AppointmentStatus.COMPLETED) {
          recordSeq++;
          const record = await prisma.medicalRecord.create({
            data: {
              recordNumber: `MR-${date.getFullYear()}-${String(recordSeq).padStart(5, '0')}`,
              hospitalId: doctor.hospitalId,
              appointmentId: appointment.id,
              patientId: patient.id,
              doctorId: doctor.id,
              vitalsBloodPressureSystolic: 110 + Math.floor(Math.random() * 40),
              vitalsBloodPressureDiastolic: 70 + Math.floor(Math.random() * 25),
              vitalsPulse: 68 + Math.floor(Math.random() * 25),
              vitalsTemperature: 98 + Math.floor(Math.random() * 20) / 10,
              vitalsSpO2: 95 + Math.floor(Math.random() * 5),
              vitalsHeight: 155 + Math.floor(Math.random() * 25),
              vitalsWeight: 55 + Math.floor(Math.random() * 30),
              chiefComplaint: appointment.reason,
              symptoms: appointment.reason,
              diagnosis: diagnoses[Math.floor(Math.random() * diagnoses.length)],
              icd10Code: icdCodes[Math.floor(Math.random() * icdCodes.length)],
              treatmentPlan: plans[Math.floor(Math.random() * plans.length)],
              notes: 'Patient advised follow-up if symptoms persist.',
            },
          });

          // Prescription for ~70% of completed records
          if (Math.random() < 0.7 && medicines.length > 0) {
            prescriptionSeq++;
            const meds = [...medicines].sort(() => Math.random() - 0.5).slice(0, 2);
            await prisma.prescription.create({
              data: {
                prescriptionNumber: `RX-${date.getFullYear()}-${String(prescriptionSeq).padStart(5, '0')}`,
                hospitalId: doctor.hospitalId,
                medicalRecordId: record.id,
                doctorId: doctor.id,
                instructions: 'Take as directed. Report any side effects immediately.',
                items: {
                  create: meds.map((m) => ({
                    medicineId: m.id,
                    dosage: m.form === 'SYRUP' || m.form === 'POWDER' ? '5 ml' : '1 tablet',
                    frequency: Math.random() < 0.5 ? 'OD' : 'BD',
                    duration: 5 + Math.floor(Math.random() * 5),
                    durationUnit: 'DAYS',
                    instructions: 'After food',
                  })),
                },
              },
            });
          }

          // Invoice (paid or finalized)
          invoiceSeq++;
          const total = Number(doctor.consultationFee);
          const isPaid = Math.random() < 0.6;
          await prisma.invoice.create({
            data: {
              invoiceNumber: `INV-${date.getFullYear()}-${String(invoiceSeq).padStart(5, '0')}`,
              hospitalId: doctor.hospitalId,
              appointmentId: appointment.id,
              patientId: patient.id,
              subtotal: total,
              taxAmount: 0,
              totalAmount: total,
              paidAmount: isPaid ? total : 0,
              balanceAmount: isPaid ? 0 : total,
              status: isPaid ? 'PAID' : 'FINALIZED',
              finalizedAt: date,
              items: {
                create: {
                  description: 'Consultation Fee',
                  category: 'CONSULTATION',
                  quantity: 1,
                  unitPrice: doctor.consultationFee,
                  totalPrice: doctor.consultationFee,
                },
              },
            },
          });

          if (isPaid) {
            await prisma.payment.create({
              data: {
                invoiceId: (await prisma.invoice.findFirst({ where: { appointmentId: appointment.id }, select: { id: true } }))!.id,
                patientId: patient.id,
                amount: total,
                method: PaymentMethod.CASH,
                status: 'COMPLETED',
                transactionId: `TXN-SEED-${invoiceSeq}`,
                gateway: 'CASH',
                paidAt: date,
              },
            });
          }

          // Lab order for ~40% of completed records (catalog-linked, varied workflow states)
          if (Math.random() < 0.4) {
            const doctorUser = await prisma.doctor.findUnique({ where: { id: doctor.id }, select: { userId: true } });
            const catalog = await prisma.labTestCatalog.findMany({ where: { hospitalId: doctor.hospitalId } });
            if (catalog.length) {
              const chosen = [...catalog].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3));
              const roll = Math.random();
              const status =
                roll < 0.55
                  ? LabOrderStatus.APPROVED
                  : roll < 0.7
                    ? LabOrderStatus.RESULT_UPLOADED
                    : roll < 0.82
                      ? LabOrderStatus.PROCESSING
                      : roll < 0.92
                        ? LabOrderStatus.SAMPLE_COLLECTED
                        : LabOrderStatus.ORDERED;

              const results = [];
              for (const t of chosen) {
                if (status !== LabOrderStatus.APPROVED && status !== LabOrderStatus.RESULT_UPLOADED) break;
                const ranges = t.referenceRanges as any;
                const range = ranges && (ranges.MALE || ranges.FEMALE) ? ranges.MALE : ranges;
                let value: string;
                let isAbnormal = false;
                if (typeof ranges === 'string') {
                  value = 'Negative';
                } else if (typeof range?.min === 'number' && typeof range?.max === 'number') {
                  const abnormal = Math.random() < 0.12;
                  isAbnormal = abnormal;
                  const lo = abnormal ? range.max : range.min;
                  const hi = abnormal ? range.max + (range.max - range.min) * 0.2 : range.max;
                  value = (lo + Math.random() * (hi - lo)).toFixed(range.min >= 1000 ? 0 : 1);
                } else if (typeof range?.max === 'number') {
                  const abnormal = Math.random() < 0.12;
                  isAbnormal = abnormal;
                  value = (abnormal ? range.max * 1.2 : range.max * (0.4 + Math.random() * 0.6)).toFixed(1);
                } else {
                  value = String(10 + Math.floor(Math.random() * 90));
                }
                results.push({
                  testName: t.name,
                  value,
                  unit: t.unit || undefined,
                  referenceRange: typeof ranges === 'string' ? ranges : `${range?.min ?? ''}${range?.min !== undefined ? ' – ' : ''}${range?.max ?? ''}`.trim(),
                  isAbnormal,
                });
              }

              const data: any = {
                orderNumber: `LAB-${date.getFullYear()}-${String(recordSeq).padStart(5, '0')}`,
                hospitalId: doctor.hospitalId,
                medicalRecordId: record.id,
                patientId: patient.id,
                orderedById: doctorUser!.userId,
                status,
                tests: {
                  create: chosen.map((t) => ({
                    catalogId: t.id,
                    testName: t.name,
                    testCode: t.code,
                    category: t.category,
                    unit: t.unit,
                    referenceRanges: t.referenceRanges,
                    price: t.price,
                  })),
                },
              };
              if (status === LabOrderStatus.SAMPLE_COLLECTED) data.sampleCollectedAt = date;
              if (status === LabOrderStatus.PROCESSING) {
                data.sampleCollectedAt = date;
                data.sampleCollectedBy = doctorUser!.userId;
              }
              if (status === LabOrderStatus.RESULT_UPLOADED || status === LabOrderStatus.APPROVED) {
                data.resultUploadedAt = date;
                data.results = { create: results };
              }
              if (status === LabOrderStatus.APPROVED) {
                data.reviewedAt = date;
                data.reviewedById = doctorUser!.userId;
              }
              await prisma.labOrder.create({ data });
            }
          }
        }
      }
    }
  }
  console.log(`📅 ${appointmentSeq} appointments seeded (2 weeks of history)`);

  // A couple of upcoming appointments for today/tomorrow for the demo patient
  const demoPatient = patients[0];
  const demoDoctor = doctors[0];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  await prisma.appointment.createMany({
    data: [
      {
        appointmentNumber: `APT-${today.getFullYear()}-DEMO-1`,
        hospitalId: demoDoctor.hospitalId,
        doctorId: demoDoctor.id,
        patientId: demoPatient.id,
        departmentId: demoDoctor.departmentId,
        scheduledDate: tomorrow,
        scheduledTime: '10:00',
        duration: 30,
        status: AppointmentStatus.CONFIRMED,
        reason: 'Follow-up consultation',
      },
      {
        appointmentNumber: `APT-${today.getFullYear()}-DEMO-2`,
        hospitalId: demoDoctor.hospitalId,
        doctorId: demoDoctor.id,
        patientId: demoPatient.id,
        departmentId: demoDoctor.departmentId,
        scheduledDate: today,
        scheduledTime: '11:30',
        duration: 30,
        status: AppointmentStatus.CONFIRMED,
        reason: 'Routine check-up',
      },
    ],
    skipDuplicates: true,
  });
  console.log('📅 Demo patient upcoming appointments seeded');

  console.log('');
  console.log('✅ SEEDING COMPLETE!');
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  🔑 DEMO CREDENTIALS');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Super Admin    : superadmin@medcore.com     / SuperAdmin@123');
  console.log('  Hospital Admin : admin@medcore.com          / Admin@123');
  console.log('  Doctor         : dr.rajesh.sharma@medcore.com / Doctor@123');
  console.log('  Patient        : rahul.verma@email.com       / Patient@123');
  console.log('  (All doctor emails are firstName.lastName@medcore.com with password Doctor@123)');
  console.log('  Receptionist   : reception@medcore.com      / Reception@123');
  console.log('  Nurse          : nurse@medcore.com            / Nurse@123');
  console.log('  Lab Tech       : labtech@medcore.com         / LabTech@123');
  console.log('  Pharmacist     : pharmacist@medcore.com     / Pharma@123');
  console.log('  Accountant     : accountant@medcore.com     / Accountant@123');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  🏥 Hospital ID: ${hospital.id}`);
  console.log('═══════════════════════════════════════════════════');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
