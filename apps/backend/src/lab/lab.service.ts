import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UserRole, LabOrderStatus, NotificationType } from '@prisma/client';

@Injectable()
export class LabService {
  constructor(private prisma: PrismaService) {}

  // ───────────────────────── Catalog ─────────────────────────

  async getCatalog(hospitalId: string, search?: string) {
    const where: any = { hospitalId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.labTestCatalog.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 25,
    });
  }

  // ───────────────────────── Orders ─────────────────────────

  async createOrder(hospitalId: string, userId: string, data: any) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { userId },
      include: { user: { select: { firstName: true, lastName: true } } },
    });
    if (!doctor) throw new ForbiddenException('Doctor profile not found for this account');

    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: data.medicalRecordId },
      include: { appointment: { select: { id: true } } },
    });
    if (!record) throw new NotFoundException('Medical record not found');
    if (record.doctorId !== doctor.id) {
      throw new ForbiddenException('You can only order tests for your own records');
    }
    if (!data.testCatalogIds?.length) {
      throw new BadRequestException('Select at least one test');
    }

    const catalogTests = await this.prisma.labTestCatalog.findMany({
      where: { id: { in: data.testCatalogIds }, hospitalId, isActive: true },
    });
    if (!catalogTests.length) throw new BadRequestException('No valid tests selected');

    const count = await this.prisma.labOrder.count();
    const order = await this.prisma.labOrder.create({
      data: {
        orderNumber: `LO-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
        hospitalId,
        medicalRecordId: record.id,
        patientId: record.patientId,
        orderedById: userId,
        notes: data.notes,
        tests: {
          create: catalogTests.map((t) => ({
            catalogId: t.id,
            testName: t.name,
            testCode: t.code,
            category: t.category,
            unit: t.unit,
            referenceRanges: t.referenceRanges,
            price: t.price,
          })),
        },
      },
      include: {
        tests: true,
        orderedBy: { select: { firstName: true, lastName: true } },
        medicalRecord: {
          include: {
            patient: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });

    // Add LAB charges to the visit invoice
    const invoice = await this.prisma.invoice.findUnique({
      where: { appointmentId: record.appointmentId },
    });
    if (invoice) {
      const labTotal = catalogTests.reduce((sum, t) => sum + Number(t.price), 0);
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: { increment: labTotal },
          totalAmount: { increment: labTotal },
          balanceAmount: { increment: labTotal },
          items: {
            create: catalogTests.map((t) => ({
              description: `Lab: ${t.name}`,
              category: 'LAB',
              quantity: 1,
              unitPrice: t.price,
              totalPrice: t.price,
              referenceId: order.id,
            })),
          },
        },
      });
    }

    // Notify hospital lab technicians
    const labTechs = await this.prisma.labTechnician.findMany({
      where: { hospitalId, isActive: true },
    });
    for (const tech of labTechs) {
      await this.prisma.notification.create({
        data: {
          userId: tech.userId,
          hospitalId,
          type: NotificationType.LAB_REPORT_READY,
          title: 'New lab order',
          message: `New lab order ${order.orderNumber} — ${catalogTests.length} test(s) for ${order.medicalRecord.patient.user.firstName} ${order.medicalRecord.patient.user.lastName}.`,
          channels: ['IN_APP'],
          entityType: 'LabOrder',
          entityId: order.id,
          inAppSent: true,
        },
      });
    }

    return order;
  }

  async findAll(hospitalId: string, user: any, status?: string) {
    const where: any = { hospitalId };
    if (status) where.status = status;

    // Role scoping: doctors see their own patients' orders, patients their own
    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!doctor) return { data: [] };
      where.medicalRecord = { doctorId: doctor.id };
    }
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient) return { data: [] };
      where.patientId = patient.id;
    }

    const orders = await this.prisma.labOrder.findMany({
      where,
      include: {
        tests: true,
        results: true,
        orderedBy: { select: { firstName: true, lastName: true, role: true } },
        medicalRecord: {
          include: {
            patient: { include: { user: { select: { firstName: true, lastName: true } } } },
            doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    return orders;
  }

  async findById(id: string, user: any) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id },
      include: {
        tests: true,
        results: true,
        orderedBy: { select: { firstName: true, lastName: true, role: true } },
        medicalRecord: {
          include: {
            patient: { include: { user: { select: { firstName: true, lastName: true, gender: true } } } },
            doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Lab order not found');

    // Tenant isolation
    if (user.role !== UserRole.SUPER_ADMIN && order.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }
    // Patients only their own
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || order.patientId !== patient.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return order;
  }

  // ───────────────────────── Workflow ─────────────────────────

  async updateStatus(id: string, user: any, status: LabOrderStatus) {
    const order = await this.prisma.labOrder.findUnique({
      where: { id },
      include: { results: { select: { id: true } } },
    });
    if (!order) throw new NotFoundException('Lab order not found');
    if (user.role !== UserRole.SUPER_ADMIN && order.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }

    const canManage =
      user.role === UserRole.SUPER_ADMIN || user.role === UserRole.LAB_TECHNICIAN || user.role === UserRole.RECEPTIONIST;
    if (!canManage) throw new ForbiddenException('Only lab staff can manage orders');

    const validTransitions: Record<string, LabOrderStatus[]> = {
      ORDERED: [LabOrderStatus.SAMPLE_COLLECTED, LabOrderStatus.REJECTED],
      SAMPLE_COLLECTED: [LabOrderStatus.PROCESSING, LabOrderStatus.REJECTED],
      PROCESSING: [LabOrderStatus.RESULT_UPLOADED, LabOrderStatus.REJECTED],
      RESULT_UPLOADED: [LabOrderStatus.APPROVED, LabOrderStatus.REJECTED],
    };
    if (!validTransitions[order.status]?.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${order.status} to ${status}`);
    }

    // Only lab technicians can mark approval-level transitions
    const reviewStatuses: LabOrderStatus[] = [LabOrderStatus.APPROVED, LabOrderStatus.REJECTED];
    if (reviewStatuses.includes(status) && user.role === UserRole.RECEPTIONIST) {
      throw new ForbiddenException('Only lab technicians can review orders');
    }
    if (status === LabOrderStatus.APPROVED && order.results.length === 0) {
      throw new BadRequestException('Results must be uploaded before approval');
    }

    const updateData: any = {};
    if (status === LabOrderStatus.SAMPLE_COLLECTED) {
      updateData.sampleCollectedAt = new Date();
      updateData.sampleCollectedBy = user.id;
    }
    if (status === LabOrderStatus.APPROVED || status === LabOrderStatus.REJECTED) {
      updateData.reviewedAt = new Date();
      updateData.reviewedById = user.id;
    }
    updateData.status = status;

    const updated = await this.prisma.labOrder.update({ where: { id }, data: updateData });

    // Notify patient + doctor when the report is approved
    if (status === LabOrderStatus.APPROVED) {
      const full = await this.prisma.labOrder.findUnique({
        where: { id },
        include: {
          medicalRecord: {
            include: {
              patient: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
              doctor: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
            },
          },
        },
      });
      const recipients = [
        {
          userId: full!.medicalRecord.patient.user.id,
          title: 'Lab report ready',
          message: `Your lab report ${updated.orderNumber} has been approved and is available in your portal.`,
        },
        {
          userId: full!.medicalRecord.doctor.user.id,
          title: 'Lab report approved',
          message: `Lab report ${updated.orderNumber} for your patient is approved and ready to review.`,
        },
      ];
      for (const r of recipients) {
        await this.prisma.notification.create({
          data: {
            userId: r.userId,
            hospitalId: order.hospitalId,
            type: NotificationType.LAB_REPORT_READY,
            title: r.title,
            message: r.message,
            channels: ['IN_APP'],
            entityType: 'LabOrder',
            entityId: id,
            inAppSent: true,
          },
        });
      }
    }

    return updated;
  }

  // ───────────────────────── Results ─────────────────────────

  async enterResults(id: string, user: any, results: Array<{ testId: string; value: string; unit?: string }>) {
    if (![UserRole.SUPER_ADMIN, UserRole.LAB_TECHNICIAN].includes(user.role)) {
      throw new ForbiddenException('Only lab technicians can enter results');
    }

    const order = await this.prisma.labOrder.findUnique({
      where: { id },
      include: {
        tests: true,
        medicalRecord: { include: { patient: { include: { user: { select: { gender: true } } } } } },
      },
    });
    if (!order) throw new NotFoundException('Lab order not found');
    if (user.role !== UserRole.SUPER_ADMIN && order.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }
    const finalStatuses: LabOrderStatus[] = [LabOrderStatus.APPROVED, LabOrderStatus.REJECTED];
    if (finalStatuses.includes(order.status)) {
      throw new BadRequestException('This order has already been finalised');
    }
    if (!results?.length) throw new BadRequestException('Provide at least one result');

    const gender = order.medicalRecord.patient.user.gender as string | undefined;

    // Re-entry replaces previous results for the order
    await this.prisma.labResult.deleteMany({ where: { labOrderId: id } });

    const created = [];
    for (const r of results) {
      const test = order.tests.find((t) => t.id === r.testId);
      if (!test) throw new BadRequestException(`Unknown test: ${r.testId}`);
      const isAbnormal = this.computeAbnormal(test.referenceRanges as any, r.value, gender);
      created.push(
        await this.prisma.labResult.create({
          data: {
            labOrderId: id,
            testName: test.testName,
            value: r.value,
            unit: r.unit || test.unit || undefined,
            referenceRange: this.formatRange(test.referenceRanges as any, gender),
            isAbnormal,
          },
        }),
      );
    }

    await this.prisma.labOrder.update({
      where: { id },
      data: {
        status: LabOrderStatus.RESULT_UPLOADED,
        resultUploadedAt: new Date(),
        resultUploadedBy: user.id,
      },
    });

    return created;
  }

  /** Flag a numeric value that falls outside the test's reference range for the patient's gender. */
  private computeAbnormal(referenceRanges: any, value: string, gender?: string): boolean {
    if (!referenceRanges) return false;
    let range = referenceRanges;
    if (gender && (referenceRanges.MALE || referenceRanges.FEMALE)) {
      range = referenceRanges[gender] || referenceRanges.MALE;
    }
    const num = parseFloat(value);
    if (isNaN(num) || !range) return false;
    if (typeof range.min === 'number' && num < range.min) return true;
    if (typeof range.max === 'number' && num > range.max) return true;
    return false;
  }

  private formatRange(referenceRanges: any, gender?: string): string {
    if (!referenceRanges) return '';
    let range = referenceRanges;
    if (gender && (referenceRanges.MALE || referenceRanges.FEMALE)) {
      range = referenceRanges[gender] || referenceRanges.MALE;
    }
    if (range && typeof range.min === 'number' && typeof range.max === 'number') {
      return `${range.min} – ${range.max}`;
    }
    if (typeof range === 'string') return range;
    return '';
  }
}
