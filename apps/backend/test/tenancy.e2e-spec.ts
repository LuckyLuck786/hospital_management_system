import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, resetDb, seedFixtures, loginAs, Fixtures, prisma } from './fixtures';

describe('Tenancy & data isolation (e2e)', () => {
  let app: INestApplication;
  let f: Fixtures;

  beforeAll(async () => {
    app = await createApp();
    await resetDb();
    f = await seedFixtures();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('a doctor cannot access a medical record from another hospital', async () => {
    const doctorB = await loginAs(app, 'doc.b@test.local'); // hospital B

    const res = await request(app.getHttpServer())
      .get(`/api/medical-records/${f.recordA}`) // hospital A record
      .set('Authorization', `Bearer ${doctorB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('a doctor only sees appointments from their own hospital', async () => {
    const doctorA = await loginAs(app, 'doc.a@test.local');
    const res = await request(app.getHttpServer())
      .get('/api/appointments?limit=100')
      .set('Authorization', `Bearer ${doctorA}`);

    expect(res.status).toBe(200);
    const all = (Array.isArray(res.body.data) ? res.body.data : res.body.data.data || []) as any[];
    expect(all.every((a) => a.hospitalId === f.hA)).toBe(true);
  });

  it('a patient cannot view another patient\u2019s medical record', async () => {
    const patientB = await loginAs(app, 'pat.b@test.local');

    const res = await request(app.getHttpServer())
      .get(`/api/medical-records/${f.recordA}`) // Alice's record
      .set('Authorization', `Bearer ${patientB}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('a patient can view their own medical record', async () => {
    const patientA = await loginAs(app, 'pat.a@test.local');

    const res = await request(app.getHttpServer())
      .get(`/api/medical-records/${f.recordA}`)
      .set('Authorization', `Bearer ${patientA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(f.recordA);
  });

  it('a patient only sees their own invoices', async () => {
    const patientB = await loginAs(app, 'pat.b@test.local');

    const res = await request(app.getHttpServer())
      .get('/api/invoices')
      .set('Authorization', `Bearer ${patientB}`);

    expect(res.status).toBe(200);
    const invoices = res.body.data as any[];
    expect(invoices.every((i) => i.patientId === f.patientB)).toBe(true);
  });
});
