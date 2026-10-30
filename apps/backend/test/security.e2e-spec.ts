import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { createApp, resetDb, seedFixtures, loginAs, Fixtures, prisma, PASSWORD } from './fixtures';

describe('User account authorization, wards and vitals (e2e)', () => {
  let app: INestApplication;
  let f: Fixtures;
  let adminA: string;
  let adminB: string;
  let nurseA: string;
  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createApp();
    await resetDb();
    f = await seedFixtures();
    const pass = await bcrypt.hash(PASSWORD, 10);
    const mk = (email: string, role: UserRole, hospitalId: string) =>
      prisma.user.create({ data: { email, password: pass, firstName: 'T', lastName: role, role, hospitalId, isEmailVerified: true, isActive: true } });
    await mk('admin.a@test.local', UserRole.HOSPITAL_ADMIN, f.hA);
    await mk('admin.b@test.local', UserRole.HOSPITAL_ADMIN, f.hB);
    await mk('nurse.a@test.local', UserRole.NURSE, f.hA);
    adminA = await loginAs(app, 'admin.a@test.local');
    adminB = await loginAs(app, 'admin.b@test.local');
    nurseA = await loginAs(app, 'nurse.a@test.local');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const userId = (email: string) => prisma.user.findUnique({ where: { email } }).then((u) => u!.id);

  it('a patient cannot edit or deactivate someone else’s account', async () => {
    const patientB = await loginAs(app, 'pat.b@test.local');
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${await userId('doc.a@test.local')}`)
      .set(auth(patientB))
      .send({ isActive: false, firstName: 'Hacked' });
    expect(res.status).toBe(403);
    const doc = await prisma.user.findUnique({ where: { email: 'doc.a@test.local' } });
    expect(doc!.isActive).toBe(true);
    expect(doc!.firstName).not.toBe('Hacked');
  });

  it('users can update their own profile, and the response never contains the password hash', async () => {
    const patientA = await loginAs(app, 'pat.a@test.local');
    const res = await request(app.getHttpServer())
      .patch(`/api/users/${await userId('pat.a@test.local')}`)
      .set(auth(patientA))
      .send({ phone: '+919999900000', isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.phone).toBe('+919999900000');
    expect(res.body.data.password).toBeUndefined();
    expect(res.body.data.isActive).toBe(true); // self-deactivation ignored
  });

  it('a hospital admin cannot read or delete users of another hospital', async () => {
    const docA = await userId('doc.a@test.local');
    expect((await request(app.getHttpServer()).get(`/api/users/${docA}`).set(auth(adminB))).status).toBe(403);
    expect((await request(app.getHttpServer()).delete(`/api/users/${docA}`).set(auth(adminB))).status).toBe(403);
    expect((await request(app.getHttpServer()).get(`/api/users/${docA}`).set(auth(adminA))).status).toBe(200);
  });

  it('manages wards: admin adds a room, nurse updates occupancy within capacity', async () => {
    const room = await request(app.getHttpServer())
      .post('/api/wards/rooms')
      .set(auth(adminA))
      .send({ roomNumber: 'W-101', type: 'General Ward', capacity: 4 });
    expect(room.status).toBe(201);

    const ok = await request(app.getHttpServer())
      .patch(`/api/wards/rooms/${room.body.data.id}/occupancy`)
      .set(auth(nurseA))
      .send({ occupiedBeds: 3 });
    expect(ok.status).toBe(200);
    const tooMany = await request(app.getHttpServer())
      .patch(`/api/wards/rooms/${room.body.data.id}/occupancy`)
      .set(auth(nurseA))
      .send({ occupiedBeds: 9 });
    expect(tooMany.status).toBe(400);
    const otherHospital = await request(app.getHttpServer())
      .patch(`/api/wards/rooms/${room.body.data.id}/occupancy`)
      .set(auth(adminB))
      .send({ occupiedBeds: 1 });
    expect(otherHospital.status).toBe(403);

    const overview = await request(app.getHttpServer()).get('/api/wards').set(auth(nurseA));
    expect(overview.body.data).toMatchObject({ totalBeds: 4, occupiedBeds: 3, occupancyRate: 75 });

    const dash = await request(app.getHttpServer()).get('/api/analytics/dashboard').set(auth(adminA));
    expect(dash.body.data.kpis).toMatchObject({ totalBeds: 4, occupiedBeds: 3 });
  });

  it('a nurse records vitals with auto-calculated BMI; the patient can read them', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/patients/${f.patientA}/vitals`)
      .set(auth(nurseA))
      .send({ systolic: 128, diastolic: 84, pulse: 76, temperature: 98.6, spo2: 98, height: 170, weight: 72 });
    expect(res.status).toBe(201);
    expect(Number(res.body.data.bmi)).toBeCloseTo(24.91, 1);

    const empty = await request(app.getHttpServer()).post(`/api/patients/${f.patientA}/vitals`).set(auth(nurseA)).send({});
    expect(empty.status).toBe(400);

    const patientA = await loginAs(app, 'pat.a@test.local');
    const list = await request(app.getHttpServer()).get(`/api/patients/${f.patientA}/vitals`).set(auth(patientA));
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
  });

  it('shows the audit trail to admins of the same hospital only', async () => {
    await new Promise((r) => setTimeout(r, 300));
    const res = await request(app.getHttpServer()).get('/api/audit-logs').set(auth(adminA));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data.every((a: any) => a.hospitalId === f.hA)).toBe(true);
    expect((await request(app.getHttpServer()).get('/api/audit-logs').set(auth(nurseA))).status).toBe(403);
  });

  it('lets a doctor edit only their own weekly schedule, with validated windows', async () => {
    const doctorA = await loginAs(app, 'doc.a@test.local');
    const own = await request(app.getHttpServer())
      .patch(`/api/doctors/${f.doctorA}/schedule`)
      .set(auth(doctorA))
      .send({ monday: [{ start: '09:00', end: '12:00', slotDuration: 30 }] });
    expect(own.status).toBe(200);

    const slots = await request(app.getHttpServer()).get(`/api/doctors/${f.doctorA}/availability?date=2026-11-02`).set(auth(doctorA));
    expect(slots.body.data.slots.length).toBe(6); // 09:00–12:00 in 30-min slots (2 Nov 2026 is a Monday)

    const bad = await request(app.getHttpServer())
      .patch(`/api/doctors/${f.doctorA}/schedule`)
      .set(auth(doctorA))
      .send({ monday: [{ start: '13:00', end: '09:00', slotDuration: 30 }] });
    expect(bad.status).toBe(400);

    const other = await request(app.getHttpServer())
      .patch(`/api/doctors/${f.doctorB}/schedule`)
      .set(auth(doctorA))
      .send({ monday: [] });
    expect(other.status).toBe(403);
    const crossAdmin = await request(app.getHttpServer()).patch(`/api/doctors/${f.doctorA}/schedule`).set(auth(adminB)).send({ monday: [] });
    expect(crossAdmin.status).toBe(403);
  });

  it('validates incoming stock and keeps it inside the hospital', async () => {
    const bad = await request(app.getHttpServer()).post(`/api/medicines/${f.med}/batches`).set(auth(adminA)).send({ batchNumber: 'X', quantity: -5, expiryDate: '2030-01-01' });
    expect(bad.status).toBe(400);
    const ok = await request(app.getHttpServer()).post(`/api/medicines/${f.med}/batches`).set(auth(adminA)).send({ batchNumber: 'OK-1', quantity: 40, expiryDate: '2030-01-01' });
    expect(ok.status).toBe(201);
    const foreign = await request(app.getHttpServer()).post(`/api/medicines/${f.med}/batches`).set(auth(adminB)).send({ batchNumber: 'B-1', quantity: 10, expiryDate: '2030-01-01' });
    expect(foreign.status).toBe(404);
  });

  it('issues a reset token by email flow and enforces a minimum password length', async () => {
    expect((await request(app.getHttpServer()).post('/api/auth/forgot-password').send({ email: 'pat.b@test.local' })).status).toBe(200);
    const { passwordResetToken } = (await prisma.user.findUnique({ where: { email: 'pat.b@test.local' } }))!;
    expect(passwordResetToken).toBeTruthy();
    const short = await request(app.getHttpServer()).post('/api/auth/reset-password').send({ token: passwordResetToken, password: 'short' });
    expect(short.status).toBe(400);
    const ok = await request(app.getHttpServer()).post('/api/auth/reset-password').send({ token: passwordResetToken, password: 'NewPass@1234' });
    expect(ok.status).toBe(200);
    const login = await request(app.getHttpServer()).post('/api/auth/login').send({ email: 'pat.b@test.local', password: 'NewPass@1234' });
    expect(login.status).toBe(200);
  }, 30000);

  it('resends a verification code only to unverified accounts, with the same response either way', async () => {
    await prisma.user.update({ where: { email: 'nurse.a@test.local' }, data: { isEmailVerified: false, emailOtp: null } });
    const a = await request(app.getHttpServer()).post('/api/auth/resend-verification').send({ email: 'nurse.a@test.local' });
    const b = await request(app.getHttpServer()).post('/api/auth/resend-verification').send({ email: 'nobody@test.local' });
    expect(a.status).toBe(200);
    expect(b.body.data.message).toBe(a.body.data.message);
    expect((await prisma.user.findUnique({ where: { email: 'nurse.a@test.local' } }))!.emailOtp).toMatch(/^\d{6}$/);
  });
});
