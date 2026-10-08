import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { createApp, resetDb, seedFixtures, loginAs, Fixtures, prisma, PASSWORD } from './fixtures';

describe('Pharmacy (e2e)', () => {
  let app: INestApplication;
  let f: Fixtures;
  let pharmacistToken: string;
  let validRx: string;
  let expiredRx: string;
  let appointmentId: string;

  const makeRx = (medicineId: string, number: string) =>
    prisma.prescription.create({
      data: {
        prescriptionNumber: number,
        hospitalId: f.hA,
        medicalRecordId: f.recordA,
        doctorId: f.doctorA,
        instructions: 'e2e test',
        items: {
          create: {
            medicineId,
            dosage: '1',
            frequency: 'BD',
            duration: 5,
            durationUnit: 'DAYS',
          },
        },
      },
    });

  beforeAll(async () => {
    app = await createApp();
    await resetDb();
    f = await seedFixtures();

    // Pharmacist user in hospital A (no profile table needed to log in)
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

    validRx = (await makeRx(f.med, 'RX-TEST-VALID')).id;
    expiredRx = (await makeRx(f.expiredMed, 'RX-TEST-EXPIRED')).id;

    const record = await prisma.medicalRecord.findUnique({
      where: { id: f.recordA },
      select: { appointmentId: true },
    });
    appointmentId = record!.appointmentId;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('dispenses a valid prescription: FIFO stock decrement, invoice line, notification', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pharmacy/dispense/${validRx}`)
      .set('Authorization', `Bearer ${pharmacistToken}`);

    expect(res.status).toBe(201);
    expect(res.body.data.isDispensed).toBe(true);
    expect(res.body.data.dispensedAt).toBeTruthy();

    // BD x 5 days = 10 units consumed from the only (valid) batch
    const batch = await prisma.medicineBatch.findFirst({
      where: { batchNumber: 'B-VALID' },
    });
    expect(batch!.quantity).toBe(90);

    // Pharmacy charges land on the visit invoice
    const invoice = await prisma.invoice.findUnique({
      where: { appointmentId },
      include: { items: true },
    });
    const pharmacyItem = invoice!.items.find((i) => i.category === 'PHARMACY');
    expect(pharmacyItem).toBeTruthy();
    expect(Number(pharmacyItem!.totalPrice)).toBe(100); // 10 units x unitPrice 10

    // Patient is notified
    const note = await prisma.notification.findFirst({
      where: { entityType: 'Prescription', entityId: validRx },
    });
    expect(note).toBeTruthy();
    expect(note!.type).toBe('PRESCRIPTION_READY');
  });

  it('never dispenses from an expired/quarantined batch (insufficient stock)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pharmacy/dispense/${expiredRx}`)
      .set('Authorization', `Bearer ${pharmacistToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toMatch(/Insufficient stock/);

    // The expired batch was not touched
    const batch = await prisma.medicineBatch.findFirst({
      where: { batchNumber: 'B-OLD' },
    });
    expect(batch!.quantity).toBe(50);
    expect(batch!.isExpired).toBe(true);
    expect(batch!.isQuarantined).toBe(true);
  });

  it('blocks a second dispense of the same prescription', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/pharmacy/dispense/${validRx}`)
      .set('Authorization', `Bearer ${pharmacistToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/already been dispensed/);
  });

  it('exposes pending prescriptions and low-stock for the hospital', async () => {
    const pending = await request(app.getHttpServer())
      .get('/api/pharmacy/prescriptions/pending')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(pending.status).toBe(200);
    // The expired-Rx (still undispensed) is pending; every pending item must show live stock
    expect((pending.body.data as any[]).length).toBeGreaterThanOrEqual(1);

    const lowStock = await request(app.getHttpServer())
      .get('/api/pharmacy/low-stock')
      .set('Authorization', `Bearer ${pharmacistToken}`);
    expect(lowStock.status).toBe(200);
    // Expired syrup has zero usable stock, so it must be flagged low
    expect((lowStock.body.data as any[]).some((m) => m.name === 'Expired Syrup')).toBe(true);
  });
});
