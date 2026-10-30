import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, resetDb, seedFixtures, loginAs, Fixtures, prisma } from './fixtures';

describe('Patient profile, vaccinations, audit log and field encryption (e2e)', () => {
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

  it('a patient cannot open another patient’s profile', async () => {
    const patientB = await loginAs(app, 'pat.b@test.local');
    const res = await request(app.getHttpServer())
      .get(`/api/patients/${f.patientA}`)
      .set('Authorization', `Bearer ${patientB}`);
    expect(res.status).toBe(403);
  });

  it('a doctor cannot open a patient profile from another hospital', async () => {
    const doctorB = await loginAs(app, 'doc.b@test.local');
    const res = await request(app.getHttpServer())
      .get(`/api/patients/${f.patientA}`)
      .set('Authorization', `Bearer ${doctorB}`);
    expect(res.status).toBe(403);
  });

  it('a doctor records a vaccination, the patient sees it, and the write is audited', async () => {
    const doctorA = await loginAs(app, 'doc.a@test.local');
    const created = await request(app.getHttpServer())
      .post(`/api/patients/${f.patientA}/vaccinations`)
      .set('Authorization', `Bearer ${doctorA}`)
      .send({ vaccineName: 'Hepatitis B', doseNumber: 2, administeredOn: '2026-10-01', batchNumber: 'HB-2291', nextDueDate: '2027-04-01' });
    expect(created.status).toBe(201);

    const patientA = await loginAs(app, 'pat.a@test.local');
    const list = await request(app.getHttpServer())
      .get(`/api/patients/${f.patientA}/vaccinations`)
      .set('Authorization', `Bearer ${patientA}`);
    expect(list.status).toBe(200);
    expect(list.body.data.map((v: any) => v.vaccineName)).toContain('Hepatitis B');

    // audit write is fire-and-forget; give it a moment
    await new Promise((r) => setTimeout(r, 300));
    const audit = await prisma.auditLog.findFirst({ where: { entityType: 'patients', action: { startsWith: 'CREATE' } } });
    expect(audit).not.toBeNull();
    expect(audit!.hospitalId).toBe(f.hA);
  });

  it('family-history flags can be set by the treating doctor', async () => {
    const doctorA = await loginAs(app, 'doc.a@test.local');
    const res = await request(app.getHttpServer())
      .patch(`/api/patients/${f.patientA}/family-history`)
      .set('Authorization', `Bearer ${doctorA}`)
      .send({ familyHistoryDiabetes: true, familyHistoryCardiac: true });
    expect(res.status).toBe(200);
    expect(res.body.data.familyHistoryDiabetes).toBe(true);
    expect(res.body.data.familyHistoryCancer).toBe(false);
  });

  it('diagnosis is stored encrypted but returned as plaintext', async () => {
    const doctorA = await loginAs(app, 'doc.a@test.local');
    const upd = await request(app.getHttpServer())
      .patch(`/api/medical-records/${f.recordA}`)
      .set('Authorization', `Bearer ${doctorA}`)
      .send({ diagnosis: 'Type 2 diabetes mellitus' });
    expect(upd.status).toBe(200);

    const raw = await prisma.$queryRaw<{ diagnosis: string }[]>`SELECT diagnosis FROM medical_records WHERE id = ${f.recordA}`;
    expect(raw[0].diagnosis.startsWith('enc:v1:')).toBe(true);
    expect(raw[0].diagnosis).not.toContain('diabetes');

    const read = await request(app.getHttpServer())
      .get(`/api/medical-records/${f.recordA}`)
      .set('Authorization', `Bearer ${doctorA}`);
    expect(read.body.data.diagnosis).toBe('Type 2 diabetes mellitus');
  });
});
