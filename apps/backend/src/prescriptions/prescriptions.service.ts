import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class PrescriptionsService {
  constructor(private prisma: PrismaService) {}

  async create(hospitalId: string, userId: string, data: any) {
    // Resolve the doctor profile for the authenticated user
    const doctor = await this.prisma.doctor.findUnique({ where: { userId } });
    if (!doctor) throw new ForbiddenException('Doctor profile not found for this account');

    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: data.medicalRecordId },
      include: { appointment: true },
    });
    if (!record) throw new NotFoundException('Medical record not found');

    // Doctors can only prescribe for their own patients' records
    if (record.doctorId !== doctor.id) {
      throw new ForbiddenException('You can only create prescriptions for your own records');
    }

    // Global sequence so prescription numbers never collide with seeded ones
    const count = await this.prisma.prescription.count();

    const prescription = await this.prisma.prescription.create({
      data: {
        prescriptionNumber: `RX-${new Date().getFullYear()}-${String(count + 1).padStart(5, '0')}`,
        hospitalId,
        medicalRecordId: data.medicalRecordId,
        doctorId: doctor.id,
        instructions: data.instructions,
        items: {
          create: data.items.map((item: any) => ({
            medicineId: item.medicineId,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration,
            durationUnit: item.durationUnit || 'DAYS',
            instructions: item.instructions,
          })),
        },
      },
      include: {
        items: { include: { medicine: true } },
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        medicalRecord: {
          include: {
            patient: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });

    // Medicine charges are added to the invoice at DISPENSE time (pharmacy fulfilment),
    // so billing reflects services actually rendered.

    return prescription;
  }

  /** List prescriptions — doctors see only their own; admins see the hospital's. */
  async findAll(hospitalId: string, user: any) {
    let where: any = { hospitalId };
    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!doctor) return [];
      where = { hospitalId, medicalRecord: { doctorId: doctor.id } };
    }

    return this.prisma.prescription.findMany({
      where,
      include: {
        items: { include: { medicine: { select: { name: true, form: true } } } },
        medicalRecord: {
          include: {
            patient: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }

  async findById(id: string, user: any) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id },
      include: {
        items: { include: { medicine: true } },
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        medicalRecord: {
          include: {
            patient: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
    });
    if (!prescription) throw new NotFoundException('Prescription not found');

    // Tenant isolation
    if (user.role !== UserRole.SUPER_ADMIN && prescription.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }

    // Patients can only view their own prescriptions
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || prescription.medicalRecord.patientId !== patient.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return prescription;
  }

  async findByMedicalRecord(medicalRecordId: string, user: any) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id: medicalRecordId },
      select: { id: true, hospitalId: true, patientId: true },
    });
    if (!record) throw new NotFoundException('Medical record not found');

    // Tenant isolation
    if (user.role !== UserRole.SUPER_ADMIN && record.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }

    // Patients can only view their own prescriptions
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || record.patientId !== patient.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return this.prisma.prescription.findMany({
      where: { medicalRecordId },
      include: {
        items: { include: { medicine: true } },
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        medicalRecord: {
          include: {
            patient: {
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
