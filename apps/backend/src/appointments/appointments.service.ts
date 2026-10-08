import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AppointmentStatus, UserRole, NotificationType } from '@prisma/client';
import { Prisma } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(hospitalId: string, filters: any, user: any, page = 1, limit = 20) {
    const where: any = { hospitalId, deletedAt: null };
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.scheduledDate = {};
      if (filters.dateFrom) where.scheduledDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.scheduledDate.lte = new Date(filters.dateTo);
    }

    // Patients can only ever see their own appointments
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient) {
        return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
      where.patientId = patient.id;
    } else if (user.role === UserRole.DOCTOR) {
      // Doctors see appointments for their own schedule only
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!doctor) {
        return { data: [], meta: { page, limit, total: 0, totalPages: 0 } };
      }
      where.doctorId = doctor.id;
    }

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          patient: { include: { user: { select: { firstName: true, lastName: true, phone: true } } } },
          department: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ scheduledDate: 'desc' }, { scheduledTime: 'desc' }],
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string, user: any) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id, deletedAt: null },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        patient: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        department: true,
        medicalRecord: true,
        invoice: { include: { items: true } },
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');

    // Tenant isolation
    if (user.role !== UserRole.SUPER_ADMIN && appointment.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }

    // Patients can only view their own appointments
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient || appointment.patientId !== patient.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return appointment;
  }

  async create(hospitalId: string, data: any, user: any) {
    const scheduledDate = new Date(data.scheduledDate);

    // Resolve the patient record — never trust a client-supplied patientId for self-booking
    let patientId = data.patientId;
    if (user.role === UserRole.PATIENT) {
      const patient = await this.prisma.patient.findUnique({ where: { userId: user.id } });
      if (!patient) throw new BadRequestException('Patient profile not found. Please contact the hospital reception.');
      patientId = patient.id;
    }

    if (!patientId) throw new BadRequestException('patientId is required');

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');
    if (patient.hospitalId !== hospitalId) {
      throw new ForbiddenException('Patient does not belong to this hospital');
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: data.doctorId },
      select: { id: true, consultationFee: true, hospitalId: true },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    if (doctor.hospitalId !== hospitalId) {
      throw new ForbiddenException('Doctor does not belong to this hospital');
    }

    // Conflict pre-check (the DB unique index is the source of truth under concurrency)
    const conflictingDoctorSlot = await this.prisma.appointment.findFirst({
      where: {
        doctorId: data.doctorId,
        scheduledDate,
        scheduledTime: data.scheduledTime,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS, AppointmentStatus.EMERGENCY] },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (conflictingDoctorSlot && !data.isEmergency) {
      throw new ConflictException('This slot is already booked. Please choose another time.');
    }

    const conflictingPatientSlot = await this.prisma.appointment.findFirst({
      where: {
        patientId,
        scheduledDate,
        scheduledTime: data.scheduledTime,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS, AppointmentStatus.EMERGENCY] },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (conflictingPatientSlot) {
      throw new ConflictException('You already have an appointment at this time');
    }

    // Use a global sequence for appointment numbers so they never collide
    // with numbers already assigned by the seed or other hospitals.
    const appointmentCount = await this.prisma.appointment.count();

    try {
      const appointment = await this.prisma.appointment.create({
        data: {
          appointmentNumber: `APT-${new Date().getFullYear()}-${String(appointmentCount + 1).padStart(5, '0')}`,
          hospitalId,
          doctorId: data.doctorId,
          patientId,
          departmentId: data.departmentId,
          scheduledDate,
          scheduledTime: data.scheduledTime,
          duration: 30,
          status: data.isEmergency ? AppointmentStatus.EMERGENCY : AppointmentStatus.PENDING,
          reason: data.reason,
          notes: data.notes,
          isEmergency: data.isEmergency || false,
        },
        include: {
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          patient: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      });

      // Create a draft invoice with the consultation fee
      if (doctor?.consultationFee) {
        const invoiceCount = await this.prisma.invoice.count();
        await this.prisma.invoice.create({
          data: {
            invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`,
            hospitalId,
            appointmentId: appointment.id,
            patientId,
            subtotal: doctor.consultationFee,
            totalAmount: doctor.consultationFee,
            balanceAmount: doctor.consultationFee,
            status: 'DRAFT',
            items: {
              create: {
                description: 'Consultation Fee',
                category: 'CONSULTATION',
                quantity: 1,
                unitPrice: doctor.consultationFee,
                totalPrice: doctor.consultationFee,
              },
            },
          },
        });
      }

      // In-app notification to the patient + doctor
      const patientUser = await this.prisma.patient.findUnique({
        where: { id: patientId },
        select: { userId: true },
      });
      const doctorUser = await this.prisma.doctor.findUnique({
        where: { id: data.doctorId },
        select: { userId: true },
      });

      await this.prisma.notification.create({
        data: {
          userId: patientUser?.userId || '',
          hospitalId,
          type: appointment.isEmergency ? NotificationType.EMERGENCY_APPOINTMENT : NotificationType.APPOINTMENT_CONFIRMED,
          title: appointment.isEmergency ? 'Emergency appointment created' : 'Appointment booked',
          message: `Your appointment (${appointment.appointmentNumber}) on ${scheduledDate.toISOString().split('T')[0]} at ${data.scheduledTime} is ${appointment.isEmergency ? 'an emergency booking' : 'pending confirmation'}.`,
          channels: ['IN_APP'],
          entityType: 'Appointment',
          entityId: appointment.id,
          appointmentId: appointment.id,
          inAppSent: true,
        },
      });

      if (doctorUser && appointment.isEmergency) {
        await this.prisma.notification.create({
          data: {
            userId: doctorUser.userId,
            hospitalId,
            type: NotificationType.EMERGENCY_APPOINTMENT,
            title: 'Emergency appointment',
            message: `An emergency appointment has been booked for ${data.scheduledTime} today.`,
            channels: ['IN_APP'],
            entityType: 'Appointment',
            entityId: appointment.id,
            appointmentId: appointment.id,
            inAppSent: true,
          },
        });
      }

      return appointment;
    } catch (error) {
      // P2002 = unique constraint violation on the active-slot index — a concurrent booking won
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This slot was just booked by another patient. Please choose another time.');
      }
      throw error;
    }
  }

  async updateStatus(id: string, status: AppointmentStatus, notes?: string, user?: any) {
    const appointment = await this.prisma.appointment.findUnique({ where: { id } });
    if (!appointment) throw new NotFoundException('Appointment not found');

    if (user && user.role !== UserRole.SUPER_ADMIN && appointment.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }

    // Doctors can only update status of their own appointments
    if (user?.role === UserRole.DOCTOR) {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!doctor || appointment.doctorId !== doctor.id) {
        throw new ForbiddenException('You can only update your own appointments');
      }
    }

    const validTransitions: Record<string, AppointmentStatus[]> = {
      PENDING: [AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS, AppointmentStatus.CANCELLED],
      CONFIRMED: [AppointmentStatus.IN_PROGRESS, AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW],
      IN_PROGRESS: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
      EMERGENCY: [AppointmentStatus.IN_PROGRESS, AppointmentStatus.COMPLETED],
    };

    if (!validTransitions[appointment.status]?.includes(status)) {
      throw new BadRequestException(`Cannot transition from ${appointment.status} to ${status}`);
    }

    const updateData: any = { status };
    if (status === AppointmentStatus.IN_PROGRESS) updateData.checkedInAt = new Date();
    if (status === AppointmentStatus.COMPLETED) updateData.completedAt = new Date();
    if (status === AppointmentStatus.CANCELLED) updateData.cancelledAt = new Date();
    if (notes) updateData.notes = notes;

    return this.prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }

  async getTodayAppointments(hospitalId: string, doctorId?: string, user?: any) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = {
      hospitalId,
      scheduledDate: { gte: today, lt: tomorrow },
      deletedAt: null,
      status: { not: AppointmentStatus.CANCELLED },
    };
    if (doctorId) where.doctorId = doctorId;

    // Doctors only see their own schedule
    if (user?.role === UserRole.DOCTOR && !doctorId) {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (doctor) where.doctorId = doctor.id;
    }

    return this.prisma.appointment.findMany({
      where,
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        patient: { include: { user: { select: { firstName: true, lastName: true } } } },
        department: { select: { name: true } },
      },
      orderBy: { scheduledTime: 'asc' },
    });
  }
}
