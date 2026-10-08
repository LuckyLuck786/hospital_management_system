import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(hospitalId: string) {
    return this.prisma.department.findMany({
      where: { hospitalId, isActive: true },
      include: { _count: { select: { doctors: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        doctors: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });
    if (!department) throw new NotFoundException('Department not found');
    return department;
  }

  async create(hospitalId: string, data: any) {
    return this.prisma.department.create({
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        hospitalId,
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.department.update({
      where: { id },
      data: {
        name: data.name,
        code: data.code,
        description: data.description,
        isActive: data.isActive,
      },
    });
  }

  async remove(id: string) {
    return this.prisma.department.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
