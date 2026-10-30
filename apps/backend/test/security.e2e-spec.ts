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

  it('manages beds: admit a patient to a specific bed, block double admission, discharge to cleaning', async () => {
    const room = await request(app.getHttpServer())
      .post('/api/wards/rooms')
      .set(auth(adminA))
      .send({ roomNumber: 'W-101', type: 'General Ward', capacity: 3 });
    expect(room.status).toBe(201);
    const [bed1, bed2] = room.body.data.beds;

    const admit = await request(app.getHttpServer())
      .post(`/api/wards/beds/${bed1.id}/admit`)
      .set(auth(nurseA))
      .send({ patientId: f.patientA, notes: 'Observation' });
    expect(admit.status).toBe(201);
    expect(admit.body.data.patient.id).toBe(f.patientA);

    // same patient cannot hold two beds; an occupied bed cannot take another patient
    const twice = await request(app.getHttpServer()).post(`/api/wards/beds/${bed2.id}/admit`).set(auth(nurseA)).send({ patientId: f.patientA });
    expect(twice.status).toBe(409);
    const taken = await request(app.getHttpServer()).post(`/api/wards/beds/${bed1.id}/admit`).set(auth(nurseA)).send({ patientId: f.patientB });
    expect(taken.status).toBe(409);
    const otherHospital = await request(app.getHttpServer()).post(`/api/wards/beds/${bed2.id}/admit`).set(auth(adminB)).send({ patientId: f.patientB });
    expect(otherHospital.status).toBe(403);

    const overview = await request(app.getHttpServer()).get('/api/wards').set(auth(nurseA));
    expect(overview.body.data).toMatchObject({ totalBeds: 3, occupiedBeds: 1, occupancyRate: 33 });
    const dash = await request(app.getHttpServer()).get('/api/analytics/dashboard').set(auth(adminA));
    expect(dash.body.data.kpis).toMatchObject({ totalBeds: 3, occupiedBeds: 1 });
    const admissions = await request(app.getHttpServer()).get('/api/wards/admissions').set(auth(nurseA));
    expect(admissions.body.data).toHaveLength(1);

    // one-step transfer: patient moves to bed 2, bed 1 goes to cleaning
    const bed3 = room.body.data.beds[2];
    const moved = await request(app.getHttpServer())
      .post(`/api/wards/beds/${bed1.id}/transfer`)
      .set(auth(nurseA))
      .send({ toBedId: bed3.id, reason: 'Needs window bed' });
    expect(moved.status).toBe(201);
    expect(moved.body.data.patient.id).toBe(f.patientA);
    expect(moved.body.data.admissionNotes).toContain('Transferred from');
    const oldBed = await prisma.bed.findUnique({ where: { id: bed1.id } });
    expect(oldBed).toMatchObject({ status: 'CLEANING', patientId: null });
    const intoBusy = await request(app.getHttpServer()).post(`/api/wards/beds/${bed3.id}/transfer`).set(auth(nurseA)).send({ toBedId: bed1.id });
    expect(intoBusy.status).toBe(409); // bed 1 is still being cleaned
    await request(app.getHttpServer()).patch(`/api/wards/beds/${bed1.id}/status`).set(auth(nurseA)).send({ status: 'AVAILABLE' });
    const back = await request(app.getHttpServer()).post(`/api/wards/beds/${bed3.id}/transfer`).set(auth(nurseA)).send({ toBedId: bed1.id });
    expect(back.status).toBe(201);

    const discharge = await request(app.getHttpServer()).post(`/api/wards/beds/${bed1.id}/discharge`).set(auth(nurseA));
    expect(discharge.status).toBe(201);
    expect(discharge.body.data.status).toBe('CLEANING');
    const blocked = await request(app.getHttpServer()).post(`/api/wards/beds/${bed1.id}/admit`).set(auth(nurseA)).send({ patientId: f.patientB });
    expect(blocked.status).toBe(409);
    const ready = await request(app.getHttpServer()).patch(`/api/wards/beds/${bed1.id}/status`).set(auth(nurseA)).send({ status: 'AVAILABLE' });
    expect(ready.status).toBe(200);
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
