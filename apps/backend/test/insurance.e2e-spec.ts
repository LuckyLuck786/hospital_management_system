import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { createApp, resetDb, seedFixtures, loginAs, Fixtures, prisma, PASSWORD } from './fixtures';

describe('Insurance / TPA claims (e2e)', () => {
  let app: INestApplication;
  let f: Fixtures;
  let accountant: string;
  let reception: string;
  let invoiceId: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createApp();
    await resetDb();
    f = await seedFixtures();
    const pass = await bcrypt.hash(PASSWORD, 10);
    for (const [email, role] of [
      ['acc.a@test.local', UserRole.ACCOUNTANT],
      ['rec.a@test.local', UserRole.RECEPTIONIST],
      ['acc.b@test.local', UserRole.ACCOUNTANT],
    ] as const) {
      await prisma.user.create({
        data: { email, password: pass, firstName: 'T', lastName: role, role, hospitalId: email.includes('.b@') ? f.hB : f.hA, isEmailVerified: true, isActive: true },
      });
    }
    accountant = await loginAs(app, 'acc.a@test.local');
    reception = await loginAs(app, 'rec.a@test.local');
    invoiceId = (await prisma.invoice.findFirst({ where: { patientId: f.patientA } }))!.id;
    await prisma.invoice.update({ where: { id: invoiceId }, data: { status: 'FINALIZED' } });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('files a claim, reviews it, partially approves and settles it onto the invoice', async () => {
    const claim = await request(app.getHttpServer())
      .post('/api/insurance-claims')
      .set(auth(reception))
      .send({ invoiceId, insurer: 'Star Health', tpaName: 'MediAssist', policyNumber: 'SH-55102', claimedAmount: 400 });
    expect(claim.status).toBe(201);
    expect(claim.body.data.claimNumber).toMatch(/^CLM-/);
    const id = claim.body.data.id;

    // only one open claim per invoice
    const dup = await request(app.getHttpServer()).post('/api/insurance-claims').set(auth(reception)).send({ invoiceId, insurer: 'X', policyNumber: 'Y' });
    expect(dup.status).toBe(409);

    // receptionists cannot adjudicate
    expect((await request(app.getHttpServer()).patch(`/api/insurance-claims/${id}/status`).set(auth(reception)).send({ status: 'UNDER_REVIEW' })).status).toBe(403);
    // cannot skip review
    expect((await request(app.getHttpServer()).patch(`/api/insurance-claims/${id}/status`).set(auth(accountant)).send({ status: 'APPROVED' })).status).toBe(400);

    expect((await request(app.getHttpServer()).patch(`/api/insurance-claims/${id}/status`).set(auth(accountant)).send({ status: 'UNDER_REVIEW' })).status).toBe(200);
    const partial = await request(app.getHttpServer())
      .patch(`/api/insurance-claims/${id}/status`)
      .set(auth(accountant))
      .send({ status: 'PARTIALLY_APPROVED', approvedAmount: 300, decisionNote: 'Room rent capped' });
    expect(partial.status).toBe(200);
    expect(Number(partial.body.data.approvedAmount)).toBe(300);

    const settle = await request(app.getHttpServer()).post(`/api/insurance-claims/${id}/settle`).set(auth(accountant)).send({});
    expect(settle.status).toBe(201);
    expect(settle.body.data.status).toBe('SETTLED');

    const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
    expect(Number(invoice!.paidAmount)).toBe(300);
    expect(Number(invoice!.balanceAmount)).toBe(200);
    expect(invoice!.payments.some((p) => p.method === 'INSURANCE' && Number(p.amount) === 300)).toBe(true);

    // policy details are remembered on the patient
    const patient = await prisma.patient.findUnique({ where: { id: f.patientA } });
    expect(patient!.insuranceProvider).toBe('Star Health');
  });

  it('rejects claims above the balance and requires a reason to reject', async () => {
    const tooMuch = await request(app.getHttpServer()).post('/api/insurance-claims').set(auth(reception)).send({ invoiceId, claimedAmount: 9999 });
    expect(tooMuch.status).toBe(400);

    const claim = await request(app.getHttpServer()).post('/api/insurance-claims').set(auth(reception)).send({ invoiceId });
    expect(claim.status).toBe(201); // insurer/policy taken from the patient profile, amount = balance
    expect(Number(claim.body.data.claimedAmount)).toBe(200);
    const id = claim.body.data.id;
    expect((await request(app.getHttpServer()).patch(`/api/insurance-claims/${id}/status`).set(auth(accountant)).send({ status: 'REJECTED' })).status).toBe(400);
    const rejected = await request(app.getHttpServer())
      .patch(`/api/insurance-claims/${id}/status`)
      .set(auth(accountant))
      .send({ status: 'REJECTED', decisionNote: 'Pre-existing condition exclusion' });
    expect(rejected.status).toBe(200);
    expect((await request(app.getHttpServer()).post(`/api/insurance-claims/${id}/settle`).set(auth(accountant))).status).toBe(400);
  });

  it('keeps claims inside the hospital and shows patients only their own', async () => {
    const otherAcc = await loginAs(app, 'acc.b@test.local');
    const list = await request(app.getHttpServer()).get('/api/insurance-claims').set(auth(otherAcc));
    expect(list.body.data).toHaveLength(0);
    const any = await prisma.insuranceClaim.findFirst();
    expect((await request(app.getHttpServer()).patch(`/api/insurance-claims/${any!.id}/status`).set(auth(otherAcc)).send({ status: 'UNDER_REVIEW' })).status).toBe(403);

    const patientA = await loginAs(app, 'pat.a@test.local');
    const mine = await request(app.getHttpServer()).get('/api/insurance-claims').set(auth(patientA));
    expect(mine.body.data.length).toBe(2);
    const patientB = await loginAs(app, 'pat.b@test.local');
    const theirs = await request(app.getHttpServer()).get('/api/insurance-claims').set(auth(patientB));
    expect(theirs.body.data).toHaveLength(0);
    const accList = await request(app.getHttpServer()).get('/api/insurance-claims').set(auth(accountant));
    expect(accList.body.meta).toMatchObject({ total: 2, settled: 300 });
  });
});
