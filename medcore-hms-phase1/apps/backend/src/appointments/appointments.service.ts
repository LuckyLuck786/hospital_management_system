import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { AppointmentStatus } from '@prisma/client';

@Injectable()
export class AppointmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(hospitalId: string, filters: any, page = 1, limit = 20) {
    const where: any = { hospitalId, deletedAt: null };
    if (filters.doctorId) where.doctorId = filters.doctorId;
    if (filters.patientId) where.patientId = filters.patientId;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.scheduledDate = {};
      if (filters.dateFrom) where.scheduledDate.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.scheduledDate.lte = new Date(filters.dateTo);
    }

    const [appointments, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        include: {
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
          patient: { include: { user: { select: { firstName: true, lastName: true } } } },
          department: { select: { id: true, name: true } },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { scheduledDate: 'desc' },
      }),
      this.prisma.appointment.count({ where }),
    ]);

    return {
      data: appointments,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const appointment = await this.prisma.appointment.findUnique({
      where: { id, deletedAt: null },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
        patient: { include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } } },
        department: true,
        medicalRecord: true,
        invoice: true,
      },
    });
    if (!appointment) throw new NotFoundException('Appointment not found');
    return appointment;
  }

  async create(hospitalId: string, data: any) {
    const scheduledDate = new Date(data.scheduledDate);

    const existingDoctorAppointment = await this.prisma.appointment.findFirst({
      where: {
        doctorId: data.doctorId,
        scheduledDate,
        scheduledTime: data.scheduledTime,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS] },
        deletedAt: null,
      },
    });

    if (existingDoctorAppointment && !data.isEmergency) {
      throw new ConflictException('This slot is already booked');
    }

    const existingPatientAppointment = await this.prisma.appointment.findFirst({
      where: {
        patientId: data.patientId,
        scheduledDate,
        scheduledTime: data.scheduledTime,
        status: { in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS] },
        deletedAt: null,
      },
    });

    if (existingPatientAppointment) {
      throw new ConflictException('Patient already has an appointment at this time');
    }

    const doctor = await this.prisma.doctor.findUnique({
      where: { id: data.doctorId },
      select: { consultationFee: true },
    });

    const appointmentCount = await this.prisma.appointment.count({ where: { hospitalId } });

    const appointment = await this.prisma.appointment.create({
      data: {
        appointmentNumber: `APT-${new Date().getFullYear()}-${String(appointmentCount + 1).padStart(5, '0')}`,
        hospitalId,
        doctorId: data.doctorId,
        patientId: data.patientId,
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

    if (doctor?.consultationFee) {
      const invoiceCount = await this.prisma.invoice.count();
      await this.prisma.invoice.create({
        data: {
          invoiceNumber: `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(5, '0')}`,
          hospitalId,
          appointmentId: appointment.id,
          patientId: data.patientId,
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

    return appointment;
  }

  async updateStatus(id: string, status: AppointmentStatus, notes?: string) {
    const appointment = await this.findById(id);
    const validTransitions: Record<string, AppointmentStatus[]> = {
      PENDING: [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED],
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

  async getTodayAppointments(hospitalId: string, doctorId?: string) {
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
