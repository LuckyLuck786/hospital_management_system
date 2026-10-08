import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, resetDb, seedFixtures, loginAs, prisma } from './fixtures';

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createApp();
    await resetDb();
    await seedFixtures();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('logs in and issues access + refresh tokens', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'doc.a@test.local', password: 'Test@123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.refreshToken).toBeTruthy();
    expect(res.body.data.user.role).toBe('DOCTOR');
  });

  it('rejects an invalid password', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'doc.a@test.local', password: 'WrongPass1' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('rotates refresh tokens: a used token cannot be replayed', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: 'pat.a@test.local', password: 'Test@123' });
    const firstRefresh = login.body.data.refreshToken;

    // First refresh succeeds and returns a NEW token
    const refresh1 = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefresh, deviceId: 'test-device' });
    expect(refresh1.status).toBe(200); // refresh is @HttpCode(OK)
    expect(refresh1.body.data.accessToken).toBeTruthy();
    expect(refresh1.body.data.refreshToken).not.toBe(firstRefresh);

    // Replaying the old (rotated) token must fail
    const replay = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: firstRefresh, deviceId: 'test-device' });
    expect(replay.status).toBe(401);
    expect(replay.body.success).toBe(false);

    // The newest token still works
    const refresh2 = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: refresh1.body.data.refreshToken, deviceId: 'test-device' });
    expect(refresh2.status).toBe(200);
  });

  it('rejects an access token without a valid session (me endpoint)', async () => {
    const res = await request(app.getHttpServer()).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('accesses /auth/me with a valid token', async () => {
    const token = await loginAs(app, 'doc.a@test.local');
    const res = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('doc.a@test.local');
  });
});
