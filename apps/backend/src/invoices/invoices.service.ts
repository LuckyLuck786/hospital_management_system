import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UserRole, InvoiceStatus, PaymentMethod, PaymentStatus, NotificationType } from '@prisma/client';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(hospitalId: string, user: any, filters: any, page = 1, limit = 20) {
    const where: any = { hospitalId };
    if (filters.status) where.status = filters.status;
    if (filters.patientId) where.patientId = filters.patientId;

    // Patients only see their own invoices
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient) {
        return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
      where.patientId = patient.id;
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        include: {
          patient: { include: { user: { select: { firstName: true, lastName: true } } } },
          appointment: { select: { appointmentNumber: true, scheduledDate: true } },
          items: true,
          _count: { select: { payments: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, user: any) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: {
        patient: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true, phone: true },
            },
          },
        },
        appointment: {
          include: {
            doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
            department: { select: { name: true } },
          },
        },
        items: true,
        payments: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');

    // Tenant isolation
    if (user.role !== UserRole.SUPER_ADMIN && invoice.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }

    // Patients only see their own invoices
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || invoice.patientId !== patient.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return invoice;
  }

  /** Finalise a draft invoice. Recomputes totals from line items to guarantee billing integrity. */
  async finalize(id: string, user: any, taxRate = 0) {
    const invoice = await this.findById(id, user);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException('Only draft invoices can be finalised');
    }

    const subtotal = invoice.items.reduce((sum, item) => sum + Number(item.totalPrice), 0);
    const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
    const totalAmount = subtotal + taxAmount - Number(invoice.discountAmount);
    const paidAmount = Number(invoice.paidAmount);

    return this.prisma.invoice.update({
      where: { id },
      data: {
        subtotal,
        taxAmount,
        totalAmount,
        balanceAmount: Math.max(totalAmount - paidAmount, 0),
        status: InvoiceStatus.FINALIZED,
        finalizedAt: new Date(),
      },
    });
  }

  /** Record a payment against an invoice and update its status. */
  async pay(id: string, user: any, data: { amount: number; method: PaymentMethod; transactionId?: string }) {
    const invoice = await this.findById(id, user);
    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException('Cannot pay a cancelled invoice');
    }
    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestException('Invoice is already paid');
    }

    const amount = Number(data.amount);
    if (!amount || amount <= 0) {
      throw new BadRequestException('Payment amount must be greater than zero');
    }

    const remaining = Number(invoice.balanceAmount);
    if (amount > remaining) {
      throw new BadRequestException(`Amount exceeds the outstanding balance of ${remaining}`);
    }

    const payment = await this.prisma.payment.create({
      data: {
        invoiceId: id,
        patientId: invoice.patientId,
        processedById: user.role === UserRole.PATIENT ? undefined : user.id,
        amount,
        method: data.method,
        status: PaymentStatus.COMPLETED,
        transactionId: data.transactionId || `TXN-${Date.now()}`,
        gateway: data.method === PaymentMethod.CASH ? 'CASH' : 'MANUAL',
        paidAt: new Date(),
      },
    });

    const newPaidAmount = Number(invoice.paidAmount) + amount;
    const newBalance = Math.max(Number(invoice.totalAmount) - newPaidAmount, 0);
    const newStatus =
      newBalance === 0
        ? InvoiceStatus.PAID
        : newPaidAmount > 0
          ? InvoiceStatus.PARTIALLY_PAID
          : invoice.status;

    await this.prisma.invoice.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        balanceAmount: newBalance,
        status: newStatus,
      },
    });

    // Notify the patient that a payment was received
    await this.prisma.notification.create({
      data: {
        userId: invoice.patient.user.id,
        hospitalId: invoice.hospitalId,
        type: NotificationType.PAYMENT_RECEIVED,
        title: 'Payment received',
        message: `Payment of ₹${amount} received for invoice ${invoice.invoiceNumber}.`,
        channels: ['IN_APP'],
        entityType: 'Invoice',
        entityId: invoice.id,
        inAppSent: true,
      },
    });

    return payment;
  }
}
