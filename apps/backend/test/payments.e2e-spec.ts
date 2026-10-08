import { INestApplication } from '@nestjs/common';
import { createHmac } from 'crypto';
import request from 'supertest';
import { createApp, resetDb, seedFixtures, loginAs, Fixtures, prisma } from './fixtures';

// Mirrors the test env's Razorpay secrets (see set-test-env.ts)
const WEBHOOK_SECRET = 'test-razorpay-webhook-secret';
const KEY_SECRET = 'test-razorpay-key-secret';

describe('Razorpay webhook (e2e)', () => {
  let app: INestApplication;
  let f: Fixtures;
  let orderId: string; // webhook tests
  let verifyOrderId: string; // verify-payment tests (fresh invoice)

  const sign = (raw: Buffer) =>
    createHmac('sha256', WEBHOOK_SECRET).update(raw).digest('hex');

  beforeAll(async () => {
    app = await createApp();
    await resetDb();
    f = await seedFixtures();

    // Simulate a checkout: order created for the fixture invoice (webhook path)
    const invoice = await prisma.invoice.findFirst({ where: { hospitalId: f.hA } });
    orderId = `order_test_${Date.now()}`;
    await prisma.invoice.update({
      where: { id: invoice!.id },
      data: { razorpayOrderId: orderId },
    });

    // A second invoice for the Standard Checkout (verify-payment) path
    const apt2 = await prisma.appointment.create({
      data: {
        appointmentNumber: 'APT-TEST-0002',
        hospitalId: f.hA,
        doctorId: f.doctorA,
        patientId: f.patientA,
        scheduledDate: new Date(),
        scheduledTime: '11:00',
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    const invoice2 = await prisma.invoice.create({
      data: {
        invoiceNumber: 'INV-TEST-0002',
        hospitalId: f.hA,
        appointmentId: apt2.id,
        patientId: f.patientA,
        subtotal: 400,
        totalAmount: 400,
        balanceAmount: 400,
        status: 'FINALIZED',
      },
    });
    verifyOrderId = 'order_verify_test_1';
    await prisma.invoice.update({
      where: { id: invoice2.id },
      data: { razorpayOrderId: verifyOrderId },
    });
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('rejects a webhook with a forged signature', async () => {
    const raw = JSON.stringify({ event: 'payment.captured' });
    const res = await request(app.getHttpServer())
      .post('/api/payments/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'deadbeef')
      .send(raw);
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/Invalid webhook signature/);
  });

  it('accepts a valid signature and marks the invoice PAID with a receipt notification', async () => {
    const payload = {
      entity: 'event',
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_test_123',
            order_id: orderId,
            amount: 50000,
            currency: 'INR',
            status: 'captured',
          },
        },
      },
    };
    const raw = JSON.stringify(payload);
    const signature = sign(Buffer.from(raw));

    const res = await request(app.getHttpServer())
      .post('/api/payments/webhook/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .send(raw);
    expect(res.status).toBe(201);
    expect(res.body.data.received).toBe(true);
    expect(res.body.data.event).toBe('payment.captured');

    const invoice = await prisma.invoice.findUnique({ where: { razorpayOrderId: orderId } });
    expect(invoice!.status).toBe('PAID');
    expect(Number(invoice!.balanceAmount)).toBe(0);
    expect(invoice!.razorpayPaymentId).toBe('pay_test_123');

    const note = await prisma.notification.findFirst({
      where: { type: 'PAYMENT_RECEIVED', entityId: invoice!.id },
    });
    expect(note).toBeTruthy();
  });

  it('exposes whether payments are configured without leaking secrets', async () => {
    const token = await loginAs(app, 'doc.a@test.local');
    const config = await request(app.getHttpServer())
      .get('/api/payments/config')
      .set('Authorization', `Bearer ${token}`);
    expect(config.status).toBe(200);
    // Never expose the webhook or key secret in the public config
    expect(JSON.stringify(config.body.data)).not.toContain(WEBHOOK_SECRET);
    expect(JSON.stringify(config.body.data)).not.toContain(KEY_SECRET);
  });

  it('rejects verify-payment with a forged signature and does not mark the invoice paid', async () => {
    const patientA = await loginAs(app, 'pat.a@test.local');
    const res = await request(app.getHttpServer())
      .post('/api/payments/verify-payment')
      .set('Authorization', `Bearer ${patientA}`)
      .send({ orderId: verifyOrderId, paymentId: 'pay_forged_1', signature: 'deadbeef' });
    expect(res.status).toBe(400);

    const invoice = await prisma.invoice.findUnique({ where: { razorpayOrderId: verifyOrderId } });
    expect(invoice!.status).not.toBe('PAID');
  });

  it('rejects verify-payment when required fields are missing', async () => {
    const patientA = await loginAs(app, 'pat.a@test.local');
    const res = await request(app.getHttpServer())
      .post('/api/payments/verify-payment')
      .set('Authorization', `Bearer ${patientA}`)
      .send({ orderId: verifyOrderId });
    expect(res.status).toBe(400);
  });

  it('accepts verify-payment with a valid signature and marks the invoice PAID', async () => {
    const paymentId = 'pay_verify_ok_1';
    const signature = createHmac('sha256', KEY_SECRET)
      .update(`${verifyOrderId}|${paymentId}`)
      .digest('hex');

    const patientA = await loginAs(app, 'pat.a@test.local');
    const res = await request(app.getHttpServer())
      .post('/api/payments/verify-payment')
      .set('Authorization', `Bearer ${patientA}`)
      .send({ orderId: verifyOrderId, paymentId, signature });
    expect(res.status).toBe(201);
    expect(res.body.data.verified).toBe(true);

    const invoice = await prisma.invoice.findUnique({ where: { razorpayOrderId: verifyOrderId } });
    expect(invoice!.status).toBe('PAID');
    expect(Number(invoice!.balanceAmount)).toBe(0);
    expect(invoice!.razorpayPaymentId).toBe(paymentId);
  });
});
