import { PrismaClient, UserRole, AppointmentStatus, Gender, BloodGroup } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create Hospital
  const hospital = await prisma.hospital.create({
    data: {
      name: 'MedCore General Hospital',
      email: 'admin@medcore.hospital',
      phone: '+91-9876543210',
      registrationNumber: 'REG-2024-001',
      address: {
        create: {
          street: '123 Healthcare Avenue',
          city: 'Mumbai',
          state: 'Maharashtra',
          zipCode: '400001',
          country: 'India',
        },
      },
    },
  });

  // Create Departments
  const departments = await prisma.$transaction([
    prisma.department.create({
      data: { name: 'Cardiology', code: 'CARD', hospitalId: hospital.id },
    }),
    prisma.department.create({
      data: { name: 'Orthopedics', code: 'ORTHO', hospitalId: hospital.id },
    }),
    prisma.department.create({
      data: { name: 'Pediatrics', code: 'PEDS', hospitalId: hospital.id },
    }),
    prisma.department.create({
      data: { name: 'General Medicine', code: 'GEN', hospitalId: hospital.id },
    }),
  ]);

  // Create Super Admin
  const superAdminPassword = await bcrypt.hash('SuperAdmin@123', 12);
  await prisma.user.create({
    data: {
      email: 'superadmin@medcore.com',
      password: superAdminPassword,
      firstName: 'Super',
      lastName: 'Admin',
      role: UserRole.SUPER_ADMIN,
      isEmailVerified: true,
    },
  });

  // Create Hospital Admin
  const adminPassword = await bcrypt.hash('Admin@123', 12);
  await prisma.user.create({
    data: {
      email: 'admin@medcore.com',
      password: adminPassword,
      firstName: 'Hospital',
      lastName: 'Admin',
      role: UserRole.HOSPITAL_ADMIN,
      hospitalId: hospital.id,
      isEmailVerified: true,
    },
  });

  // Create Doctors
  const doctorSpecs = [
    { name: 'Dr. Rajesh Sharma', spec: 'Cardiology', dept: departments[0].id, fee: 500 },
    { name: 'Dr. Priya Patel', spec: 'Orthopedics', dept: departments[1].id, fee: 400 },
    { name: 'Dr. Amit Kumar', spec: 'Pediatrics', dept: departments[2].id, fee: 350 },
    { name: 'Dr. Sunita Gupta', spec: 'General Medicine', dept: departments[3].id, fee: 300 },
  ];

  for (const doc of doctorSpecs) {
    const [firstName, ...lastParts] = doc.name.split(' ');
    const lastName = lastParts.join(' ');
    const password = await bcrypt.hash('Doctor@123', 12);

    const user = await prisma.user.create({
      data: {
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@medcore.com`,
        password,
        firstName,
        lastName,
        role: UserRole.DOCTOR,
        hospitalId: hospital.id,
        isEmailVerified: true,
        gender: Gender.MALE,
      },
    });

    await prisma.doctor.create({
      data: {
        userId: user.id,
        hospitalId: hospital.id,
        departmentId: doc.dept,
        specialization: doc.spec,
        qualification: 'MBBS, MD',
        experienceYears: 10,
        consultationFee: doc.fee,
        weeklySchedule: {
          monday: [
            { start: '09:00', end: '13:00', slotDuration: 30 },
            { start: '14:00', end: '17:00', slotDuration: 30 },
          ],
          tuesday: [
            { start: '09:00', end: '13:00', slotDuration: 30 },
            { start: '14:00', end: '17:00', slotDuration: 30 },
          ],
          wednesday: [
            { start: '09:00', end: '13:00', slotDuration: 30 },
            { start: '14:00', end: '17:00', slotDuration: 30 },
          ],
          thursday: [
            { start: '09:00', end: '13:00', slotDuration: 30 },
            { start: '14:00', end: '17:00', slotDuration: 30 },
          ],
          friday: [
            { start: '09:00', end: '13:00', slotDuration: 30 },
            { start: '14:00', end: '17:00', slotDuration: 30 },
          ],
          saturday: [{ start: '09:00', end: '13:00', slotDuration: 30 }],
        },
      },
    });
  }

  // Create Patients
  const patientNames = ['Rahul Verma', 'Anita Desai', 'Vikram Rao', 'Neha Singh', 'Kiran Mehta'];
  for (let i = 0; i < patientNames.length; i++) {
    const [firstName, lastName] = patientNames[i].split(' ');
    const password = await bcrypt.hash('Patient@123', 12);

    const user = await prisma.user.create({
      data: {
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.com`,
        password,
        firstName,
        lastName,
        role: UserRole.PATIENT,
        hospitalId: hospital.id,
        isEmailVerified: true,
        gender: i % 2 === 0 ? Gender.MALE : Gender.FEMALE,
        bloodGroup: BloodGroup.O_POSITIVE,
      },
    });

    await prisma.patient.create({
      data: {
        userId: user.id,
        hospitalId: hospital.id,
        patientId: `PAT-2024-${String(i + 1).padStart(4, '0')}`,
        emergencyContactName: 'Family Member',
        emergencyContactPhone: '+91-9999999999',
      },
    });
  }

  // Create Receptionist
  const recPassword = await bcrypt.hash('Reception@123', 12);
  await prisma.user.create({
    data: {
      email: 'reception@medcore.com',
      password: recPassword,
      firstName: 'Reception',
      lastName: 'Desk',
      role: UserRole.RECEPTIONIST,
      hospitalId: hospital.id,
      isEmailVerified: true,
    },
  });

  console.log('✅ Seeding completed!');
  console.log('🏥 Hospital ID:', hospital.id);
  console.log('');
  console.log('🔑 Demo Credentials:');
  console.log('  Super Admin: superadmin@medcore.com / SuperAdmin@123');
  console.log('  Hospital Admin: admin@medcore.com / Admin@123');
  console.log('  Doctor: rajesh.sharma@medcore.com / Doctor@123');
  console.log('  Patient: rahul.verma@email.com / Patient@123');
  console.log('  Receptionist: reception@medcore.com / Reception@123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
