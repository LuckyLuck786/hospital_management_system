import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ClaimStatus, InvoiceStatus, NotificationChannel, NotificationType, PaymentMethod, UserRole } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { InvoicesService } from '../invoices/invoices.service';
import { NotificationsService } from '../notifications/notifications.service';

const OPEN: ClaimStatus[] = [ClaimStatus.SUBMITTED, ClaimStatus.UNDER_REVIEW, ClaimStatus.APPROVED, ClaimStatus.PARTIALLY_APPROVED];

// Allowed status moves; SETTLED is reached only through settle()
const NEXT: Partial<Record<ClaimStatus, ClaimStatus[]>> = {
  SUBMITTED: [ClaimStatus.UNDER_REVIEW, ClaimStatus.REJECTED],
  UNDER_REVIEW: [ClaimStatus.APPROVED, ClaimStatus.PARTIALLY_APPROVED, ClaimStatus.REJECTED],
};

const INCLUDE = {
  preAuthorization: { select: { id: true, requestNumber: true, approvedAmount: true } },
  invoice: { select: { id: true, invoiceNumber: true, totalAmount: true, paidAmount: true, balanceAmount: true, status: true } },
  patient: { select: { id: true, patientId: true, user: { select: { firstName: true, lastName: true } } } },
} as const;

@Injectable()
export class InsuranceService {
  constructor(
    private prisma: PrismaService,
    private invoices: InvoicesService,
    private notifications: NotificationsService,
  ) {}

  async list(hospitalId: string | undefined, user: any, status?: string) {
    const where: any = {};
    if (user.role !== UserRole.SUPER_ADMIN) where.hospitalId = hospitalId;
    if (status) where.status = status;
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      where.patientId = patient?.id ?? '__none__';
    }
    const claims = await this.prisma.insuranceClaim.findMany({ where, include: INCLUDE, orderBy: { submittedAt: 'desc' }, take: 200 });
    const totals = claims.reduce(
      (t, c) => {
        t.claimed += Number(c.claimedAmount);
        if (c.status === ClaimStatus.SETTLED) t.settled += Number(c.approvedAmount ?? 0);
        if (OPEN.includes(c.status)) t.open += 1;
        return t;
      },
      { claimed: 0, settled: 0, open: 0 },
    );
    return { data: claims, meta: { total: claims.length, ...totals } };
  }

  async create(hospitalId: string, user: any, data: any) {
    if (!data?.invoiceId) throw new BadRequestException('invoiceId is required');
    const invoice = await this.invoices.findById(data.invoiceId, user); // tenant check
    if (invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestException(`Cannot claim against a ${invoice.status.toLowerCase()} invoice`);
    }
    const open = await this.prisma.insuranceClaim.findFirst({ where: { invoiceId: invoice.id, status: { in: OPEN } } });
    if (open) throw new ConflictException(`Claim ${open.claimNumber} is already open for this invoice`);

    const patient = await this.prisma.patient.findUnique({ where: { id: invoice.patientId } });
    let preAuth: any = null;
    if (data.preAuthorizationId) {
      preAuth = await this.prisma.preAuthorization.findUnique({ where: { id: data.preAuthorizationId } });
      if (!preAuth || preAuth.patientId !== invoice.patientId) throw new BadRequestException('Pre-authorisation does not belong to this patient');
      if (preAuth.status !== ClaimStatus.APPROVED && preAuth.status !== ClaimStatus.PARTIALLY_APPROVED) {
        throw new BadRequestException('Only an approved pre-authorisation can be linked');
      }
    }
    const insurer = String(data.insurer || preAuth?.insurer || patient?.insuranceProvider || '').trim();
    const policyNumber = String(data.policyNumber || preAuth?.policyNumber || patient?.insurancePolicyNumber || '').trim();
    if (!insurer || !policyNumber) throw new BadRequestException('Insurer and policy number are required');

    const balance = Number(invoice.balanceAmount);
    const claimedAmount = data.claimedAmount != null ? Number(data.claimedAmount) : balance;
    if (!(claimedAmount > 0) || claimedAmount > balance) {
      throw new BadRequestException(`Claimed amount must be between 1 and the outstanding balance (${balance})`);
    }

    const count = await this.prisma.insuranceClaim.count();
    const claim = await this.prisma.insuranceClaim.create({
      data: {
        claimNumber: `CLM-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
        hospitalId: invoice.hospitalId,
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        insurer,
        tpaName: data.tpaName ? String(data.tpaName) : preAuth?.tpaName ?? null,
        policyNumber,
        preAuthorizationId: preAuth?.id ?? null,
        claimedAmount,
        notes: data.notes || null,
        submittedById: user.id,
      },
      include: INCLUDE,
    });
    // Remember the policy on the patient profile for next time
    if (patient && (!patient.insuranceProvider || !patient.insurancePolicyNumber)) {
      await this.prisma.patient.update({ where: { id: patient.id }, data: { insuranceProvider: insurer, insurancePolicyNumber: policyNumber } });
    }
    return claim;
  }

  private async load(id: string, user: any) {
    const claim = await this.prisma.insuranceClaim.findUnique({ where: { id }, include: INCLUDE });
    if (!claim) throw new NotFoundException('Claim not found');
    if (user.role !== UserRole.SUPER_ADMIN && claim.hospitalId !== user.hospitalId) throw new ForbiddenException('Access denied');
    return claim;
  }

  async updateStatus(id: string, user: any, data: { status: ClaimStatus; approvedAmount?: number; decisionNote?: string }) {
    const claim = await this.load(id, user);
    if (!NEXT[claim.status]?.includes(data.status)) {
      throw new BadRequestException(`Cannot move a ${claim.status} claim to ${data.status}`);
    }
    const update: any = { status: data.status, reviewedById: user.id, decisionNote: data.decisionNote ?? claim.decisionNote };
    if (data.status === ClaimStatus.APPROVED) {
      update.approvedAmount = claim.claimedAmount;
      update.decidedAt = new Date();
    }
    if (data.status === ClaimStatus.PARTIALLY_APPROVED) {
      const amt = Number(data.approvedAmount);
      if (!(amt > 0) || amt >= Number(claim.claimedAmount)) {
        throw new BadRequestException('A partial approval must be more than 0 and less than the claimed amount');
      }
      update.approvedAmount = amt;
      update.decidedAt = new Date();
    }
    if (data.status === ClaimStatus.REJECTED) {
      if (!data.decisionNote) throw new BadRequestException('Give a reason for rejecting the claim');
      update.approvedAmount = 0;
      update.decidedAt = new Date();
    }
    return this.prisma.insuranceClaim.update({ where: { id }, data: update, include: INCLUDE });
  }

  /** Records the insurer's payment against the invoice and closes the claim. */
  async settle(id: string, user: any, data: { transactionId?: string }) {
    const claim = await this.load(id, user);
    if (claim.status !== ClaimStatus.APPROVED && claim.status !== ClaimStatus.PARTIALLY_APPROVED) {
      throw new BadRequestException('Only approved claims can be settled');
    }
    const invoice = await this.invoices.findById(claim.invoiceId, user);
    const amount = Math.min(Number(claim.approvedAmount), Number(invoice.balanceAmount));
    if (amount > 0) {
      await this.invoices.pay(claim.invoiceId, user, {
        amount,
        method: PaymentMethod.INSURANCE,
        transactionId: data?.transactionId || claim.claimNumber,
      });
    }
    const settled = await this.prisma.insuranceClaim.update({
      where: { id },
      data: { status: ClaimStatus.SETTLED, settledAt: new Date(), approvedAmount: amount },
      include: INCLUDE,
    });

    const patientUser = await this.prisma.patient.findUnique({ where: { id: claim.patientId }, select: { userId: true } });
    if (patientUser) {
      await this.notifications
        .create({
          userId: patientUser.userId,
          hospitalId: claim.hospitalId,
          type: NotificationType.PAYMENT_RECEIVED,
          title: 'Insurance claim settled',
          message: `${claim.insurer} paid ₹${amount.toLocaleString('en-IN')} towards invoice ${claim.invoice.invoiceNumber} (claim ${claim.claimNumber}).`,
          channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        })
        .catch(() => undefined);
    }
    return settled;
  }

  /* ------------------------------------------------------------ Pre-authorisation */

  async listPreAuths(hospitalId: string | undefined, user: any, status?: string) {
    const where: any = {};
    if (user.role !== UserRole.SUPER_ADMIN) where.hospitalId = hospitalId;
    if (status) where.status = status;
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      where.patientId = patient?.id ?? '__none__';
    }
    return this.prisma.preAuthorization.findMany({
      where,
      include: { patient: INCLUDE.patient, claims: { select: { id: true, claimNumber: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  async createPreAuth(hospitalId: string, user: any, data: any) {
    const patient = await this.prisma.patient.findFirst({ where: { id: data?.patientId, deletedAt: null } });
    if (!patient || (user.role !== UserRole.SUPER_ADMIN && patient.hospitalId !== hospitalId)) throw new NotFoundException('Patient not found');
    const insurer = String(data.insurer || patient.insuranceProvider || '').trim();
    const policyNumber = String(data.policyNumber || patient.insurancePolicyNumber || '').trim();
    if (!insurer || !policyNumber) throw new BadRequestException('Insurer and policy number are required');
    const treatment = String(data.treatment || '').trim();
    if (treatment.length < 5) throw new BadRequestException('Describe the planned treatment');
    const estimatedAmount = Number(data.estimatedAmount);
    if (!(estimatedAmount > 0)) throw new BadRequestException('Estimated amount must be greater than zero');

    const count = await this.prisma.preAuthorization.count();
    const pa = await this.prisma.preAuthorization.create({
      data: {
        requestNumber: `PA-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
        hospitalId: patient.hospitalId,
        patientId: patient.id,
        insurer,
        tpaName: data.tpaName ? String(data.tpaName) : null,
        policyNumber,
        treatment,
        estimatedAmount,
        requestedById: user.id,
      },
      include: { patient: INCLUDE.patient },
    });
    if (!patient.insuranceProvider || !patient.insurancePolicyNumber) {
      await this.prisma.patient.update({ where: { id: patient.id }, data: { insuranceProvider: insurer, insurancePolicyNumber: policyNumber } });
    }
    return pa;
  }

  async updatePreAuth(id: string, user: any, data: { status: ClaimStatus; approvedAmount?: number; decisionNote?: string; validDays?: number }) {
    const pa = await this.prisma.preAuthorization.findUnique({ where: { id } });
    if (!pa) throw new NotFoundException('Pre-authorisation not found');
    if (user.role !== UserRole.SUPER_ADMIN && pa.hospitalId !== user.hospitalId) throw new ForbiddenException('Access denied');
    if (!NEXT[pa.status]?.includes(data.status)) throw new BadRequestException(`Cannot move a ${pa.status} request to ${data.status}`);

    const update: any = { status: data.status, reviewedById: user.id, decisionNote: data.decisionNote ?? pa.decisionNote };
    const validUntil = new Date(Date.now() + (Number(data.validDays) || 30) * 24 * 3600 * 1000);
    if (data.status === ClaimStatus.APPROVED) Object.assign(update, { approvedAmount: pa.estimatedAmount, decidedAt: new Date(), validUntil });
    if (data.status === ClaimStatus.PARTIALLY_APPROVED) {
      const amt = Number(data.approvedAmount);
      if (!(amt > 0) || amt >= Number(pa.estimatedAmount)) throw new BadRequestException('A partial approval must be more than 0 and less than the estimate');
      Object.assign(update, { approvedAmount: amt, decidedAt: new Date(), validUntil });
    }
    if (data.status === ClaimStatus.REJECTED) {
      if (!data.decisionNote) throw new BadRequestException('Give a reason for rejecting the request');
      Object.assign(update, { approvedAmount: 0, decidedAt: new Date() });
    }
    const saved = await this.prisma.preAuthorization.update({ where: { id }, data: update, include: { patient: INCLUDE.patient } });

    if (data.status !== ClaimStatus.UNDER_REVIEW) {
      const p = await this.prisma.patient.findUnique({ where: { id: pa.patientId }, select: { userId: true } });
      if (p) {
        await this.notifications
          .create({
            userId: p.userId,
            hospitalId: pa.hospitalId,
            type: NotificationType.INVOICE_GENERATED,
            title: `Pre-authorisation ${data.status === ClaimStatus.REJECTED ? 'declined' : 'approved'}`,
            message:
              data.status === ClaimStatus.REJECTED
                ? `${pa.insurer} declined cashless request ${pa.requestNumber}: ${data.decisionNote}`
                : `${pa.insurer} approved ₹${Number(saved.approvedAmount).toLocaleString('en-IN')} for ${pa.treatment} (request ${pa.requestNumber}).`,
            channels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
          })
          .catch(() => undefined);
      }
    }
    return saved;
  }
}
