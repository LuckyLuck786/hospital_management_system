import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class HospitalsService {
  constructor(private prisma: PrismaService) {}

  async findAll(page = 1, limit = 20) {
    const [hospitals, total] = await Promise.all([
      this.prisma.hospital.findMany({
        where: { deletedAt: null },
        include: {
          address: true,
          _count: { select: { users: true, departments: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.hospital.count({ where: { deletedAt: null } }),
    ]);

    return {
      data: hospitals,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const hospital = await this.prisma.hospital.findUnique({
      where: { id, deletedAt: null },
      include: {
        address: true,
        departments: { where: { isActive: true } },
        _count: {
          select: { users: true, doctors: true, patients: true },
        },
      },
    });

    if (!hospital) throw new NotFoundException('Hospital not found');
    return hospital;
  }

  async create(data: any) {
    return this.prisma.hospital.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        website: data.website,
        registrationNumber: data.registrationNumber,
        address: data.address ? { create: data.address } : undefined,
      },
    });
  }

  async update(id: string, data: any) {
    const hospital = await this.prisma.hospital.findUnique({ where: { id } });
    if (!hospital) throw new NotFoundException('Hospital not found');

    return this.prisma.hospital.update({
      where: { id },
      data: {
        name: data.name,
        phone: data.phone,
        website: data.website,
        isActive: data.isActive,
        isVerified: data.isVerified,
      },
    });
  }
}
