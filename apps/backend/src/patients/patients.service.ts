import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(hospitalId: string, search?: string, page = 1, limit = 20) {
    const where: any = { hospitalId, deletedAt: null };
    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      };
    }

    const [patients, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              gender: true,
              bloodGroup: true,
              dateOfBirth: true,
              createdAt: true,
            },
          },
          _count: { select: { appointments: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patient.count({ where }),
    ]);

    return {
      data: patients,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, user: any) {
    await this.assertAccess(id, user);
    const patient = await this.prisma.patient.findUnique({
      where: { id, deletedAt: null },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            gender: true,
            bloodGroup: true,
            dateOfBirth: true,
          },
        },
        appointments: {
          orderBy: { scheduledDate: 'desc' },
          take: 10,
          include: {
            doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
            department: { select: { name: true } },
          },
        },
        _count: { select: { appointments: true, invoices: true, medicalRecords: true } },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  /** Tenant isolation for staff; patients may only reach their own profile. */
  private async assertAccess(patientId: string, user: any) {
    const patient = await this.prisma.patient.findFirst({
      where: { id: patientId, deletedAt: null },
      select: { id: true, hospitalId: true, userId: true },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    if (user.role === UserRole.PATIENT && patient.userId !== user.id) {
      throw new ForbiddenException('You can only view your own profile');
    }
    if (user.role !== UserRole.SUPER_ADMIN && patient.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }
    return patient;
  }

  async listVaccinations(patientId: string, user: any) {
    await this.assertAccess(patientId, user);
    return this.prisma.vaccination.findMany({
      where: { patientId },
      orderBy: { administeredOn: 'desc' },
    });
  }

  async addVaccination(patientId: string, data: any, user: any) {
    const patient = await this.assertAccess(patientId, user);
    if (!data?.vaccineName || !data?.administeredOn) {
      throw new BadRequestException('vaccineName and administeredOn are required');
    }
    return this.prisma.vaccination.create({
      data: {
        hospitalId: patient.hospitalId,
        patientId,
        vaccineName: String(data.vaccineName),
        doseNumber: data.doseNumber != null ? Number(data.doseNumber) : null,
        administeredOn: new Date(data.administeredOn),
        batchNumber: data.batchNumber ?? null,
        nextDueDate: data.nextDueDate ? new Date(data.nextDueDate) : null,
        notes: data.notes ?? null,
        recordedById: user.id,
      },
    });
  }

  async updateFamilyHistory(patientId: string, data: any, user: any) {
    await this.assertAccess(patientId, user);
    const flags = ['familyHistoryDiabetes', 'familyHistoryHypertension', 'familyHistoryCancer', 'familyHistoryCardiac'];
    const update: Record<string, boolean> = {};
    for (const f of flags) if (typeof data?.[f] === 'boolean') update[f] = data[f];
    return this.prisma.patient.update({
      where: { id: patientId },
      data: update,
      select: { id: true, ...Object.fromEntries(flags.map((f) => [f, true])) },
    });
  }

  async listVitals(patientId: string, user: any, limit = 30) {
    await this.assertAccess(patientId, user);
    return this.prisma.vitalSign.findMany({
      where: { patientId },
      orderBy: { recordedAt: 'desc' },
      take: Math.min(limit, 100),
    });
  }

  async addVitals(patientId: string, data: any, user: any) {
    const patient = await this.assertAccess(patientId, user);
    const num = (v: any) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
    const height = num(data.height);
    const weight = num(data.weight);
    // BMI = kg / m², auto-calculated when both are present
    const bmi = height && weight ? Math.round((weight / Math.pow(height / 100, 2)) * 100) / 100 : null;
    const values = [data.systolic, data.diastolic, data.pulse, data.temperature, data.spo2, height, weight].map(num);
    if (values.every((v) => v == null)) throw new BadRequestException('Record at least one vital sign');
    return this.prisma.vitalSign.create({
      data: {
        hospitalId: patient.hospitalId,
        patientId,
        appointmentId: data.appointmentId || null,
        systolic: num(data.systolic),
        diastolic: num(data.diastolic),
        pulse: num(data.pulse),
        temperature: num(data.temperature),
        spo2: num(data.spo2),
        respiratoryRate: num(data.respiratoryRate),
        height,
        weight,
        bmi,
        notes: data.notes || null,
        recordedById: user.id,
      },
    });
  }
}
