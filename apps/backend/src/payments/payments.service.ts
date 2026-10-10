import {
  Injectable,
  Logger,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import Razorpay from 'razorpay';
import { PrismaService } from '../common/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { InvoiceStatus, NotificationChannel, NotificationType, UserRole } from '@prisma/client';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly client: Razorpay | null;

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    // Treat template/test placeholders (containing 'xxx' or all-zero test keys) as not configured.
    const placeholder = (v?: string) => !v || /xxx|your_|example|0000000000/i.test(v);
    this.client = !placeholder(keyId) && !placeholder(keySecret) ? new Razorpay({ key_id: keyId!, key_secret: keySecret! }) : null;
    if (!this.client) {
      this.logger.warn('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set — online payments disabled.');
    }
  }

  /** Standard Checkout can be initiated as soon as key id + secret are present. */
  get configured(): boolean {
    return !!this.client;
  }

  /** Whether incoming webhooks can be verified (a reconciliation safety net, not a checkout prerequisite). */
  get webhookConfigured(): boolean {
    return !!process.env.RAZORPAY_WEBHOOK_SECRET;
  }

  /** Public-safe config for the frontend checkout (never the secret). */
  config() {
    return {
      configured: this.configured,
      webhookConfigured: this.webhookConfigured,
      keyId: process.env.RAZORPAY_KEY_ID || '',
    };
  }

  /** Create a Razorpay order for the invoice's outstanding balance. */
  async createOrder(user: any, invoiceId: string) {
    if (!this.client) {
      throw new BadRequestException(
        'Online payments are not configured for this hospital yet. Please pay at the counter.',
      );
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { patient: { include: { user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } } } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Tenant + ownership checks
    if (user.role !== UserRole.SUPER_ADMIN && invoice.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || invoice.patientId !== patient.id) throw new ForbiddenException('Access denied');
    }
    if (invoice.status === InvoiceStatus.PAID) throw new BadRequestException('Invoice is already paid');
    if (invoice.status === InvoiceStatus.CANCELLED) throw new BadRequestException('Invoice is cancelled');

    const amountPaise = Math.round(Number(invoice.balanceAmount) * 100);
    if (amountPaise < 100) {
      throw new BadRequestException('Minimum payable amount is ₹1 (100 paise)');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let order: any;
    try {
      order = await this.client.orders.create({
        amount: amountPaise,
        currency: 'INR',
        receipt: invoice.invoiceNumber,
        notes: { invoiceId: invoice.id },
      });
    } catch (err) {
      this.logger.error(`Razorpay order creation failed: ${(err as Error).message}`);
      throw new InternalServerErrorException('Razorpay could not create the order. Please try again.');
    }

    await this.prisma.invoice.update({
      where: { id: invoice.id },
      data: { razorpayOrderId: order.id },
    });

    return {
      orderId: order.id,
      amount: amountPaise,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      invoiceNumber: invoice.invoiceNumber,
    };
  }

  /** HMAC-SHA256 over the raw body, compared in constant time. */
  verifySignature(rawBody: Buffer, signature: string): boolean {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /** Handle a verified Razorpay webhook event. */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<{ received: boolean; event?: string }> {
    if (!this.verifySignature(rawBody, signature)) {
      throw new BadRequestException('Invalid webhook signature');
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new BadRequestException('Malformed webhook payload');
    }

    const event = payload.event as string;
    if (event === 'payment.captured') {
      const entity = payload.payload?.payment?.entity;
      if (!entity?.order_id) return { received: true, event };

      const invoice = await this.prisma.invoice.findUnique({
        where: { razorpayOrderId: entity.order_id },
        include: { patient: { include: { user: { select: { id: true, email: true, firstName: true, lastName: true } } } } },
      });
      if (!invoice) {
        this.logger.warn(`Razorpay payment captured for unknown order ${entity.order_id}`);
        return { received: true, event };
      }
      if (invoice.status !== InvoiceStatus.PAID) {
        const paid = Number(entity.amount) / 100;
        await this.prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: InvoiceStatus.PAID,
            paidAmount: paid,
            balanceAmount: 0,
            razorpayPaymentId: entity.id,
            finalizedAt: new Date(),
          },
        });
        this.logger.log(`Invoice ${invoice.invoiceNumber} marked PAID via Razorpay (₹${paid})`);

        // Receipt notification (in-app + email)
        await this.notifications.create({
          userId: invoice.patient.user.id,
          hospitalId: invoice.hospitalId,
          type: NotificationType.PAYMENT_RECEIVED,
          title: 'Payment received',
          message: `Payment of ₹${paid} for invoice ${invoice.invoiceNumber} was received via Razorpay. Thank you!`,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
          entityType: 'Invoice',
          entityId: invoice.id,
        });
      }
      return { received: true, event };
    }

    if (event === 'payment.failed') {
      this.logger.warn(`Razorpay payment failed: ${payload.payload?.payment?.entity?.id || 'unknown'}`);
      return { received: true, event };
    }

    return { received: true, event };
  }

  /**
   * Verify a Standard Checkout signature: HMAC-SHA256(order_id + "|" + payment_id)
   * signed with the key secret. Constant-time compare; never trust client claims.
   */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret || !orderId || !paymentId || !signature) return false;
    const expected = createHmac('sha256', secret).update(`${orderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(signature, 'utf8');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  /**
   * Complete the Standard Checkout flow: validate the three fields returned by the
   * Razorpay checkout modal, verify the signature, and mark the invoice PAID.
   * The webhook remains the authoritative reconciliation from the gateway.
   */
  async verifyPayment(user: any, data: { orderId: string; paymentId: string; signature: string }) {
    const { orderId, paymentId, signature } = data || {};
    if (!orderId || !paymentId || !signature) {
      throw new BadRequestException('orderId, paymentId and signature are required');
    }
    if (!this.verifyPaymentSignature(orderId, paymentId, signature)) {
      throw new BadRequestException('Payment signature verification failed');
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { razorpayOrderId: orderId },
      include: { patient: { include: { user: { select: { id: true } } } } },
    });
    if (!invoice) throw new NotFoundException('No invoice matches this payment order');

    // Tenant + ownership checks
    if (user.role !== UserRole.SUPER_ADMIN && invoice.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || invoice.patientId !== patient.id) throw new ForbiddenException('Access denied');
    }

    if (invoice.status !== InvoiceStatus.PAID) {
      const paid = Number(invoice.balanceAmount);
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          status: InvoiceStatus.PAID,
          paidAmount: paid,
          balanceAmount: 0,
          razorpayPaymentId: paymentId,
          finalizedAt: new Date(),
        },
      });
      this.logger.log(`Invoice ${invoice.invoiceNumber} marked PAID via Standard Checkout (₹${paid})`);

      await this.notifications.create({
        userId: invoice.patient.user.id,
        hospitalId: invoice.hospitalId,
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Payment received',
        message: `Payment of ₹${paid} for invoice ${invoice.invoiceNumber} was received. Thank you!`,
        channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        entityType: 'Invoice',
        entityId: invoice.id,
      });
    }

    return {
      verified: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      status: InvoiceStatus.PAID,
    };
  }
}
