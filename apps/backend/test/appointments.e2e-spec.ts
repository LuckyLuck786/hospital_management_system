import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, resetDb, seedFixtures, loginAs, Fixtures, prisma } from './fixtures';

describe('Appointments (e2e)', () => {
  let app: INestApplication;
  let f: Fixtures;

  const bookSlot = (token: string, patientId: string, time: string) =>
    request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        doctorId: f.doctorA,
        patientId,
        scheduledDate: '2026-09-15',
        scheduledTime: time,
        duration: 30,
        reason: 'slot conflict test',
      });

  beforeAll(async () => {
    app = await createApp();
    await resetDb();
    f = await seedFixtures();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('books an appointment and auto-creates a draft invoice with the consultation fee', async () => {
    const patientA = await loginAs(app, 'pat.a@test.local');

    const res = await bookSlot(patientA, f.patientA, '11:30');
    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('PENDING');

    const invoice = await prisma.invoice.findUnique({
      where: { appointmentId: res.body.data.id },
      include: { items: true },
    });
    expect(invoice).toBeTruthy();
    expect(invoice!.status).toBe('DRAFT');
    expect(invoice!.items.some((i) => i.category === 'CONSULTATION')).toBe(true);
    expect(Number(invoice!.totalAmount)).toBeGreaterThan(0);
  });

  it('rejects a second booking of the exact same slot (concurrency guard)', async () => {
    const patientA = await loginAs(app, 'pat.a@test.local');
    const patientB = await loginAs(app, 'pat.b@test.local');

    // Same doctor, same date, same time — second request must fail
    const first = await bookSlot(patientA, f.patientA, '12:00');
    expect(first.status).toBe(201);

    const second = await bookSlot(patientB, f.patientB, '12:00');
    expect(second.status).toBeGreaterThanOrEqual(400);
    expect(second.body.success).toBe(false);
  });

  it('allows the same patient to book a different time on the same day', async () => {
    const patientA = await loginAs(app, 'pat.a@test.local');

    const res = await request(app.getHttpServer())
      .post('/api/appointments')
      .set('Authorization', `Bearer ${patientA}`)
      .send({
        doctorId: f.doctorA,
        patientId: f.patientA,
        scheduledDate: '2026-09-15',
        scheduledTime: '14:00',
        duration: 30,
        reason: 'free slot',
      });

    expect(res.status).toBe(201);
  });
});
