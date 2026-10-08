import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { createApp, resetDb, seedFixtures, loginAs, Fixtures, prisma, PASSWORD } from './fixtures';

describe('Invoice integrity (e2e)', () => {
  let app: INestApplication;
  let f: Fixtures;
  let pharmacistToken: string;
  let appointmentId: string;
  let invoiceId: string;

  const assertConsistent = (inv: {
    subtotal: unknown;
    discountAmount: unknown;
    taxAmount: unknown;
    totalAmount: unknown;
    paidAmount: unknown;
    balanceAmount: unknown;
  }) => {
    const subtotal = Number(inv.subtotal);
    const discount = Number(inv.discountAmount);
    const tax = Number(inv.taxAmount);
    const total = Number(inv.totalAmount);
    expect(total).toBeCloseTo(subtotal - discount + tax, 2);
    expect(Number(inv.balanceAmount)).toBeCloseTo(total - Number(inv.paidAmount), 2);
  };

  beforeAll(async () => {
    app = await createApp();
    await resetDb();
    f = await seedFixtures();

    // Pharmacist in hospital A
    const pass = await bcrypt.hash(PASSWORD, 10);
    await prisma.user.create({
      data: {
        email: 'pharm.test@test.local',
        password: pass,
        firstName: 'Pharm',
        lastName: 'Test',
        role: UserRole.PHARMACIST,
        hospitalId: f.hA,
        isEmailVerified: true,
        isActive: true,
      },
    });
    pharmacistToken = await loginAs(app, 'pharm.test@test.local');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('auto-creates a DRAFT invoice on booking with consistent arithmetic', async () => {
    const patientA = await loginAs(app, 'pat.a@test.local');
    const res = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientA}`)
      .send({
        doctorId: f.doctorA,
        patientId: f.patientA,
        scheduledDate: '2026-10-01',
        scheduledTime: '09:30',
        duration: 30,
        reason: 'invoice integrity',
      });

    expect(res.status).toBe(201);
    appointmentId = res.body.data.id;

    const invoice = await prisma.invoice.findUnique({
      where: { appointmentId },
      include: { items: true },
    });
    expect(invoice).toBeTruthy();
    expect(invoice!.status).toBe('DRAFT');
    expect(Number(invoice!.totalAmount)).toBe(500); // doctor A consultation fee

    // Line items must sum to the subtotal
    const itemSum = invoice!.items.reduce((s, i) => s + Number(i.totalPrice), 0);
    expect(Number(invoice!.subtotal)).toBeCloseTo(itemSum, 2);
    assertConsistent(invoice!);
    invoiceId = invoice!.id;
  });

  it('dispensing adds a PHARMACY line and keeps totals consistent', async () => {
    // The prescription must hang off a record for the booked appointment so the
    // dispense service finds this visit's invoice.
    const record = await prisma.medicalRecord.create({
      data: {
        recordNumber: 'MR-TEST-INV-0001',
        hospitalId: f.hA,
        appointmentId,
        patientId: f.patientA,
        doctorId: f.doctorA,
        diagnosis: 'Routine',
        chiefComplaint: 'Check-up',
      },
    });

    const rx = await prisma.prescription.create({
      data: {
        prescriptionNumber: 'RX-TEST-INV',
        hospitalId: f.hA,
        medicalRecordId: record.id,
        doctorId: f.doctorA,
        items: {
          create: {
            medicineId: f.med,
            dosage: '1',
            frequency: 'OD',
            duration: 3,
            durationUnit: 'DAYS',
          },
        },
      },
    });

    const res = await request(app.getHttpServer())
      .post(`/api/pharmacy/dispense/${rx.id}`)
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(res.status).toBe(201);

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { items: true },
    });
    // 3 units x unitPrice 10 = 30 added
    expect(Number(invoice!.totalAmount)).toBeCloseTo(530, 2);

    const itemSum = invoice!.items.reduce((s, i) => s + Number(i.totalPrice), 0);
    expect(Number(invoice!.subtotal)).toBeCloseTo(itemSum, 2);
    assertConsistent(invoice!);
  });

  it('a payment reduces the balance by exactly the paid amount', async () => {
    const patientA = await loginAs(app, 'pat.a@test.local');
    const res = await request(app.getHttpServer())
      .post(`/api/invoices/${invoiceId}/pay`)
      .set('Authorization', `Bearer ${patientA}`)
      .send({
        amount: 100,
        method: 'CARD',
        transactionId: 'TXN-E2E-001',
      });

    expect([201, 200]).toContain(res.status);

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
    expect(Number(invoice!.paidAmount)).toBeCloseTo(100, 2);
    expect(Number(invoice!.balanceAmount)).toBeCloseTo(430, 2);
    assertConsistent(invoice!);
  });
});
