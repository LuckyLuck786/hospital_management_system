import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { createApp, resetDb, seedFixtures, loginAs, Fixtures, prisma, PASSWORD } from './fixtures';

/** End-to-end walk through the main clinical, admin and auth workflows. */
describe('Clinical, admin and auth workflows (e2e)', () => {
  let app: INestApplication;
  let f: Fixtures;
  let http: () => any;
  let doctorA: string;
  let patientA: string;
  let adminA: string;
  let labTech: string;
  let superAdmin: string;
  let catalogId: string;

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createApp();
    await resetDb();
    f = await seedFixtures();
    http = () => app.getHttpServer();

    const pass = await bcrypt.hash(PASSWORD, 10);
    const mk = (email: string, role: UserRole, hospitalId: string | null) =>
      prisma.user.create({
        data: { email, password: pass, firstName: role, lastName: 'User', role, hospitalId, isEmailVerified: true, isActive: true },
      });
    await mk('admin.a@test.local', UserRole.HOSPITAL_ADMIN, f.hA);
    await mk('lab.a@test.local', UserRole.LAB_TECHNICIAN, f.hA);
    await mk('super@test.local', UserRole.SUPER_ADMIN, null);

    const cat = await prisma.labTestCatalog.create({
      data: {
        hospitalId: f.hA,
        name: 'Haemoglobin',
        code: 'HB',
        category: 'Haematology',
        unit: 'g/dL',
        referenceRanges: { MALE: { min: 13, max: 17.5 }, FEMALE: { min: 12, max: 16 } },
        price: 200,
      },
    });
    catalogId = cat.id;

    doctorA = await loginAs(app, 'doc.a@test.local');
    patientA = await loginAs(app, 'pat.a@test.local');
    adminA = await loginAs(app, 'admin.a@test.local');
    labTech = await loginAs(app, 'lab.a@test.local');
    superAdmin = await loginAs(app, 'super@test.local');
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('runs the lab workflow: order → sample → processing → results → approval', async () => {
    const catalog = await request(http()).get('/api/lab/catalog?search=haem').set(auth(doctorA));
    expect(catalog.status).toBe(200);

    const order = await request(http())
      .post('/api/lab/orders')
      .set(auth(doctorA))
      .send({ medicalRecordId: f.recordA, testCatalogIds: [catalogId] });
    expect(order.status).toBe(201);
    const orderId = order.body.data.id;

    const queue = await request(http()).get('/api/lab/orders').set(auth(labTech));
    expect(queue.status).toBe(200);

    for (const status of ['SAMPLE_COLLECTED', 'PROCESSING']) {
      const r = await request(http()).patch(`/api/lab/orders/${orderId}/status`).set(auth(labTech)).send({ status });
      expect(r.status).toBe(200);
    }

    const detail = await request(http()).get(`/api/lab/orders/${orderId}`).set(auth(labTech));
    const testId = detail.body.data.tests[0].id;
    const results = await request(http())
      .post(`/api/lab/orders/${orderId}/results`)
      .set(auth(labTech))
      .send({ results: [{ testId, value: '9.1' }] });
    expect(results.status).toBe(201);

    // skipping straight back to ORDERED is not a valid transition
    const bad = await request(http()).patch(`/api/lab/orders/${orderId}/status`).set(auth(labTech)).send({ status: 'ORDERED' });
    expect(bad.status).toBe(400);

    const approve = await request(http()).patch(`/api/lab/orders/${orderId}/status`).set(auth(labTech)).send({ status: 'APPROVED' });
    expect(approve.status).toBe(200);

    const seen = await request(http()).get(`/api/lab/orders/${orderId}`).set(auth(patientA));
    expect(seen.status).toBe(200);
  });

  it('a doctor writes a prescription that the record and listings return', async () => {
    const rx = await request(http())
      .post('/api/prescriptions')
      .set(auth(doctorA))
      .send({
        medicalRecordId: f.recordA,
        instructions: 'Take after food',
        items: [{ medicineId: f.med, dosage: '500 mg', frequency: 'BD', duration: 5 }],
      });
    expect(rx.status).toBe(201);

    expect((await request(http()).get('/api/prescriptions').set(auth(doctorA))).status).toBe(200);
    expect((await request(http()).get(`/api/prescriptions/${rx.body.data.id}`).set(auth(doctorA))).status).toBe(200);
    expect((await request(http()).get(`/api/prescriptions/record/${f.recordA}`).set(auth(doctorA))).status).toBe(200);
    expect((await request(http()).get(`/api/medical-records/patient/${f.patientA}`).set(auth(doctorA))).status).toBe(200);
  });

  it('serves analytics, search and catalogue reads to hospital staff', async () => {
    for (const path of [
      '/api/analytics/dashboard',
      '/api/analytics/revenue?from=2026-01-01&to=2026-12-31',
      '/api/analytics/appointment-volume?days=7',
      '/api/analytics/patient-growth?days=14',
      '/api/search?q=test',
      '/api/medicines?search=tab',
      `/api/medicines/${f.med}`,
      '/api/doctors',
      `/api/doctors/${f.doctorA}`,
      `/api/doctors/${f.doctorA}/availability?date=2026-11-02`,
      '/api/departments',
      '/api/patients?search=ali',
      '/api/users?role=DOCTOR',
      '/api/users/me',
      '/api/pharmacy/low-stock',
    ]) {
      const res = await request(http()).get(path).set(auth(adminA));
      expect([path, res.status]).toEqual([path, 200]);
    }
    expect((await request(http()).get('/api/analytics/dashboard').set(auth(doctorA))).status).toBe(200);
    expect((await request(http()).get('/api/search?q=alice').set(auth(doctorA))).status).toBe(200);
    // revenue analytics is finance-only
    expect((await request(http()).get('/api/analytics/revenue').set(auth(doctorA))).status).toBe(403);
  });

  it('lets a hospital admin manage departments, staff and pharmacy stock', async () => {
    const dept = await request(http()).post('/api/departments').set(auth(adminA)).send({ name: 'Neurology', code: 'NEU' });
    expect(dept.status).toBe(201);
    expect((await request(http()).get(`/api/departments/${dept.body.data.id}`).set(auth(adminA))).status).toBe(200);
    expect(
      (await request(http()).patch(`/api/departments/${dept.body.data.id}`).set(auth(adminA)).send({ description: 'Brain & spine' })).status,
    ).toBe(200);

    const user = await request(http())
      .post('/api/users')
      .set(auth(adminA))
      .send({ email: 'nurse.new@test.local', password: 'Nurse@1234', firstName: 'New', lastName: 'Nurse', role: 'NURSE' });
    expect(user.status).toBe(201);
    expect((await request(http()).get(`/api/users/${user.body.data.id}`).set(auth(adminA))).status).toBe(200);
    expect((await request(http()).patch(`/api/users/${user.body.data.id}`).set(auth(adminA)).send({ lastName: 'Renamed' })).status).toBe(200);

    const med = await request(http())
      .post('/api/medicines')
      .set(auth(adminA))
      .send({ name: 'Amoxicillin 500', genericName: 'Amoxicillin', form: 'CAPSULE', unitPrice: 12, reorderLevel: 50 });
    expect(med.status).toBe(201);
    const batch = await request(http())
      .post(`/api/medicines/${med.body.data.id}/batches`)
      .set(auth(adminA))
      .send({ batchNumber: 'AMX-01', quantity: 200, expiryDate: '2028-01-01', manufacturingDate: '2026-01-01', unitCost: 8, mrp: 12 });
    expect(batch.status).toBe(201);
  });

  it('lets the super admin onboard and update hospitals; others are refused', async () => {
    expect((await request(http()).get('/api/hospitals').set(auth(superAdmin))).status).toBe(200);
    const h = await request(http())
      .post('/api/hospitals')
      .set(auth(superAdmin))
      .send({ name: 'Onboarded Clinic', email: 'clinic@test.local', phone: '+910000000000' });
    expect(h.status).toBe(201);
    expect((await request(http()).get(`/api/hospitals/${h.body.data.id}`).set(auth(superAdmin))).status).toBe(200);
    expect((await request(http()).patch(`/api/hospitals/${h.body.data.id}`).set(auth(superAdmin)).send({ isVerified: true })).status).toBe(200);
    expect((await request(http()).get('/api/hospitals').set(auth(adminA))).status).toBe(403);
  });

  it('registers, verifies email by OTP, and handles password reset requests', async () => {
    const email = 'new.patient@test.local';
    const reg = await request(http())
      .post('/api/auth/register')
      .send({ email, password: 'Patient@1234', firstName: 'New', lastName: 'Patient' });
    expect(reg.status).toBe(201);

    const wrong = await request(http()).post('/api/auth/verify-email').send({ email, otp: '000000' });
    expect(wrong.status).toBe(400);

    const { emailOtp } = (await prisma.user.findUnique({ where: { email } }))!;
    const ok = await request(http()).post('/api/auth/verify-email').send({ email, otp: emailOtp });
    expect(ok.status).toBe(200);

    const dup = await request(http())
      .post('/api/auth/register')
      .send({ email, password: 'Patient@1234', firstName: 'New', lastName: 'Patient' });
    expect(dup.status).toBe(409);

    expect((await request(http()).post('/api/auth/forgot-password').send({ email })).status).toBe(200);
    expect((await request(http()).post('/api/auth/forgot-password').send({ email: 'nobody@test.local' })).status).toBe(200);
    expect((await request(http()).post('/api/auth/reset-password').send({ token: 'bogus', password: 'Whatever@123' })).status).toBe(400);

    // phone OTP needs a phone number on file
    const noPhone = await request(http()).post('/api/auth/send-phone-otp').set(auth(patientA));
    expect(noPhone.status).toBe(400);
    const badOtp = await request(http()).post('/api/auth/verify-phone').set(auth(patientA)).send({ otp: '123456' });
    expect(badOtp.status).toBe(400);
  }, 30000); // bcrypt cost 12 on register is slow by design
});
