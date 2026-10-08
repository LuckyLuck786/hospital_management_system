import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

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

  async findById(id: string) {
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
}
