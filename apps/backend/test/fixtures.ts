import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { PrismaClient, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { PrismaClientExceptionFilter } from '../src/common/filters/prisma-exception.filter';

export const prisma = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_URL },
  },
});

/** Boot the full app against the test database (mirrors main.ts middleware). */
export async function createApp(): Promise<INestApplication> {
  // rawBody: true mirrors main.ts so Razorpay webhook signatures can be verified
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.use(require('cookie-parser')());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter(), new PrismaClientExceptionFilter());
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

/** Wipe all test tables in FK-safe order. */
export async function resetDb() {
  await prisma.$transaction([
    prisma.refreshToken.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.invoiceItem.deleteMany(),
    prisma.invoice.deleteMany(),
    prisma.labResult.deleteMany(),
    prisma.labTest.deleteMany(),
    prisma.labOrder.deleteMany(),
    prisma.prescriptionItem.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.medicalRecord.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.medicineBatch.deleteMany(),
    prisma.medicine.deleteMany(),
    prisma.doctor.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.user.deleteMany(),
    prisma.hospital.deleteMany(),
  ]);
}

export const PASSWORD = 'Test@123';

export interface Fixtures {
  hA: string;
  hB: string;
  doctorA: string;
  doctorB: string;
  patientA: string;
  patientB: string;
  recordA: string;
  med: string;
  expiredMed: string;
}

/** Login and return the access token. */
export async function loginAs(app: INestApplication, email: string) {
  const res = await request(app.getHttpServer()).post('/api/auth/login').send({ email, password: PASSWORD });
  expect(res.status).toBe(200); // auth controller uses @HttpCode(OK)
  expect(res.body.success).toBe(true);
  return res.body.data.accessToken as string;
}

/** Seed two hospitals, two doctors, two patients, a record, and medicines. */
export async function seedFixtures(): Promise<Fixtures> {
  const pass = await bcrypt.hash(PASSWORD, 10);

  const hA = await prisma.hospital.create({ data: { name: 'Test Hospital A', email: 'a@test.local' } });
  const hB = await prisma.hospital.create({ data: { name: 'Test Hospital B', email: 'b@test.local' } });

  const mkUser = (email: string, firstName: string, lastName: string, role: UserRole, hospitalId: string) =>
    prisma.user.create({
      data: {
        email,
        password: pass,
        firstName,
        lastName,
        role,
        hospitalId,
        isEmailVerified: true,
        isActive: true,
      },
    });

  const userDocA = await mkUser('doc.a@test.local', 'Alpha', 'Doctor', UserRole.DOCTOR, hA.id);
  const userDocB = await mkUser('doc.b@test.local', 'Beta', 'Doctor', UserRole.DOCTOR, hB.id);
  const userPatA = await mkUser('pat.a@test.local', 'Alice', 'Patient', UserRole.PATIENT, hA.id);
  const userPatB = await mkUser('pat.b@test.local', 'Bob', 'Patient', UserRole.PATIENT, hA.id);

  const doctorA = await prisma.doctor.create({
    data: { userId: userDocA.id, hospitalId: hA.id, specialization: 'Cardiology', consultationFee: 500 },
  });
  const doctorB = await prisma.doctor.create({
    data: { userId: userDocB.id, hospitalId: hB.id, specialization: 'Neurology', consultationFee: 600 },
  });

  const patientA = await prisma.patient.create({
    data: { userId: userPatA.id, hospitalId: hA.id, patientId: 'PT-A-0001' },
  });
  const patientB = await prisma.patient.create({
    data: { userId: userPatB.id, hospitalId: hA.id, patientId: 'PT-A-0002' },
  });

  const apt = await prisma.appointment.create({
    data: {
      appointmentNumber: 'APT-TEST-0001',
      hospitalId: hA.id,
      doctorId: doctorA.id,
      patientId: patientA.id,
      scheduledDate: new Date(),
      scheduledTime: '10:00',
      status: 'COMPLETED',
      completedAt: new Date(),
    },
  });

  const recordA = await prisma.medicalRecord.create({
    data: {
      recordNumber: 'MR-TEST-0001',
      hospitalId: hA.id,
      appointmentId: apt.id,
      patientId: patientA.id,
      doctorId: doctorA.id,
      diagnosis: 'Hypertension',
      chiefComplaint: 'Routine check',
    },
  });

  // Real booking flow auto-creates a DRAFT invoice with the consultation fee.
  await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-TEST-0001',
      hospitalId: hA.id,
      appointmentId: apt.id,
      patientId: patientA.id,
      subtotal: 500,
      totalAmount: 500,
      balanceAmount: 500,
      status: 'DRAFT',
      items: {
        create: {
          description: 'Consultation Fee',
          category: 'CONSULTATION',
          quantity: 1,
          unitPrice: 500,
          totalPrice: 500,
        },
      },
    },
  });

  const med = await prisma.medicine.create({
    data: {
      hospital: { connect: { id: hA.id } },
      name: 'Test Tablet',
      genericName: 'Test',
      form: 'TABLET',
      manufacturer: 'Test Mfg',
      unitPrice: 10,
      mrp: 12,
      reorderLevel: 5,
    },
  });
  const expiredMed = await prisma.medicine.create({
    data: {
      hospital: { connect: { id: hA.id } },
      name: 'Expired Syrup',
      genericName: 'Expired',
      form: 'SYRUP',
      manufacturer: 'Test Mfg',
      unitPrice: 20,
      mrp: 24,
    },
  });

  await prisma.medicineBatch.create({
    data: {
      medicineId: med.id,
      batchNumber: 'B-VALID',
      manufacturingDate: new Date('2026-01-01'),
      expiryDate: new Date('2027-01-01'),
      quantity: 100,
      unitCost: 7,
      mrp: 12,
    },
  });
  await prisma.medicineBatch.create({
    data: {
      medicineId: expiredMed.id,
      batchNumber: 'B-OLD',
      manufacturingDate: new Date('2024-01-01'),
      expiryDate: new Date('2025-01-01'),
      quantity: 50,
      unitCost: 10,
      mrp: 24,
      isExpired: true,
      isQuarantined: true,
    },
  });

  return {
    hA: hA.id,
    hB: hB.id,
    doctorA: doctorA.id,
    doctorB: doctorB.id,
    patientA: patientA.id,
    patientB: patientB.id,
    recordA: recordA.id,
    med: med.id,
    expiredMed: expiredMed.id,
  };
}
