import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(hospitalId?: string, role?: UserRole, search?: string, page = 1, limit = 20) {
    const where: any = { deletedAt: null };
    if (hospitalId) where.hospitalId = hospitalId;
    if (role) where.role = role;
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }

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
        isActive: true, isEmailVerified: true, isPhoneVerified: true,
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

    if (data.hospitalId) {
      const profileData: any = { userId: user.id, hospitalId: data.hospitalId };

      switch (data.role) {
        case UserRole.DOCTOR:
          profileData.departmentId = data.departmentId;
          profileData.specialization = data.specialization || 'General';
          profileData.qualification = data.qualification;
          profileData.consultationFee = data.consultationFee;
          await this.prisma.doctor.create({ data: profileData });
          break;
        case UserRole.PATIENT: {
          const count = await this.prisma.patient.count();
          profileData.patientId = `PAT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
          profileData.emergencyContactName = data.emergencyContactName;
          profileData.emergencyContactPhone = data.emergencyContactPhone;
          await this.prisma.patient.create({ data: profileData });
          break;
        }
        case UserRole.NURSE:
          profileData.departmentId = data.departmentId;
          profileData.qualification = data.qualification;
          await this.prisma.nurse.create({ data: profileData });
          break;
        case UserRole.RECEPTIONIST:
          await this.prisma.receptionist.create({ data: profileData });
          break;
        case UserRole.LAB_TECHNICIAN:
          profileData.specialization = data.specialization;
          await this.prisma.labTechnician.create({ data: profileData });
          break;
        case UserRole.PHARMACIST:
          profileData.licenseNumber = data.licenseNumber;
          await this.prisma.pharmacist.create({ data: profileData });
          break;
        case UserRole.ACCOUNTANT:
          await this.prisma.accountant.create({ data: profileData });
          break;
      }
    }

    return user;
  }

  /** PRD §8: users are readable/editable by themselves or by an admin of the same hospital. */
  private assertSelfOrAdmin(target: { id: string; hospitalId: string | null }, actor: any) {
    if (actor.id === target.id || actor.role === UserRole.SUPER_ADMIN) return;
    if (actor.role === UserRole.HOSPITAL_ADMIN && target.hospitalId === actor.hospitalId) return;
    throw new ForbiddenException('You can only access your own account');
  }

  async findByIdFor(id: string, actor: any) {
    const target = await this.prisma.user.findFirst({ where: { id, deletedAt: null }, select: { id: true, hospitalId: true } });
    if (!target) throw new NotFoundException('User not found');
    this.assertSelfOrAdmin(target, actor);
    return this.findById(id);
  }

  async update(id: string, data: any, actor: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    this.assertSelfOrAdmin(user, actor);
    const isAdmin = actor.role === UserRole.SUPER_ADMIN || actor.role === UserRole.HOSPITAL_ADMIN;

    const updateData: any = {};
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.phone) updateData.phone = data.phone;
    if (data.dateOfBirth) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.gender) updateData.gender = data.gender;
    if (data.bloodGroup) updateData.bloodGroup = data.bloodGroup;
    if (data.phone && data.phone !== user.phone) updateData.isPhoneVerified = false;
    // Only admins may (de)activate accounts, and never their own
    if (data.isActive !== undefined && isAdmin && actor.id !== id) updateData.isActive = Boolean(data.isActive);

    await this.prisma.user.update({ where: { id }, data: updateData });
    return this.findById(id);
  }

  async remove(id: string, actor: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (actor.id === id) throw new ForbiddenException('You cannot delete your own account');
    this.assertSelfOrAdmin(user, actor);
    return this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
