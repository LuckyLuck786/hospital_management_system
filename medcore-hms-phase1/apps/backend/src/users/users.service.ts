import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(hospitalId?: string, role?: UserRole, page = 1, limit = 20) {
    const where: any = { deletedAt: null };
    if (hospitalId) where.hospitalId = hospitalId;
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: {
          id: true, email: true, firstName: true, lastName: true,
          phone: true, role: true, hospitalId: true,
          isActive: true, isEmailVerified: true, createdAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id, deletedAt: null },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        phone: true, role: true, hospitalId: true,
        isActive: true, isEmailVerified: true,
        dateOfBirth: true, gender: true, bloodGroup: true,
        createdAt: true, updatedAt: true,
        address: true,
        doctor: {
          select: {
            id: true, specialization: true, qualification: true,
            experienceYears: true, consultationFee: true, isAvailable: true,
          },
        },
        patient: {
          select: {
            id: true, patientId: true,
            emergencyContactName: true, emergencyContactPhone: true,
            insuranceProvider: true,
          },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async create(data: any) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existingUser) throw new ConflictException('Email already registered');

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        role: data.role,
        hospitalId: data.hospitalId,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        gender: data.gender,
        bloodGroup: data.bloodGroup,
        isEmailVerified: true,
        address: data.address ? { create: data.address } : undefined,
      },
    });

    if (data.role === UserRole.DOCTOR && data.hospitalId) {
      await this.prisma.doctor.create({
        data: {
          userId: user.id,
          hospitalId: data.hospitalId,
          departmentId: data.departmentId,
          specialization: data.specialization || 'General',
          qualification: data.qualification,
          consultationFee: data.consultationFee,
        },
      });
    } else if (data.role === UserRole.PATIENT && data.hospitalId) {
      const count = await this.prisma.patient.count();
      await this.prisma.patient.create({
        data: {
          userId: user.id,
          hospitalId: data.hospitalId,
          patientId: `PAT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        },
      });
    }

    return user;
  }

  async update(id: string, data: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updateData: any = {};
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.phone) updateData.phone = data.phone;
    if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.gender) updateData.gender = data.gender;
    if (data.bloodGroup) updateData.bloodGroup = data.bloodGroup;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return this.prisma.user.update({ where: { id }, data: updateData });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
