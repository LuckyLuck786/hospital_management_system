import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UserRole, InvoiceStatus, AppointmentStatus } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  /** Role-aware dashboard metrics for hospital staff. */
  async dashboard(hospitalId: string, user: any) {
    if (![UserRole.SUPER_ADMIN, UserRole.HOSPITAL_ADMIN, UserRole.DOCTOR, UserRole.RECEPTIONIST, UserRole.ACCOUNTANT, UserRole.PHARMACIST, UserRole.NURSE, UserRole.LAB_TECHNICIAN].includes(user.role)) {
      throw new ForbiddenException('Access denied');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const last7 = new Date(today);
    last7.setDate(last7.getDate() - 6);
    const last14 = new Date(today);
    last14.setDate(last14.getDate() - 13);

    // Doctors only see their own slice
    let doctorFilter: any = {};
    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!doctor) throw new ForbiddenException('Doctor profile not found');
      doctorFilter = { doctorId: doctor.id };
    }

    const [
      patientsTotal,
      patientsToday,
      doctorsTotal,
      appointmentsToday,
      appointmentsPendingReview,
      revenueToday,
      lowStockMedicines,
      departments,
      recentActivity,
    ] = await Promise.all([
      this.prisma.patient.count({ where: { hospitalId, deletedAt: null } }),
      this.prisma.patient.count({ where: { hospitalId, createdAt: { gte: today, lt: tomorrow } } }),
      this.prisma.doctor.count({ where: { hospitalId, isAvailable: true } }),
      this.prisma.appointment.count({
        where: {
          hospitalId,
          scheduledDate: { gte: today, lt: tomorrow },
          status: { not: AppointmentStatus.CANCELLED },
          ...doctorFilter,
        },
      }),
      // Lab orders awaiting review (hospital-wide; for doctors, their patients')
      this.prisma.labOrder.count({
        where: {
          hospitalId,
          status: 'RESULT_UPLOADED',
          ...(user.role === UserRole.DOCTOR
            ? { medicalRecord: { doctorId: doctorFilter.doctorId } }
            : {}),
        },
      }),
      this.prisma.payment.aggregate({
        where: { paidAt: { gte: today, lt: tomorrow }, status: 'COMPLETED' },
        _sum: { amount: true },
      }),
      this.prisma.medicine.findMany({
        where: { hospitalId, isActive: true },
        include: {
          batches: { where: { isQuarantined: false, isExpired: false }, select: { quantity: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.findMany({
        where: { hospitalId },
        include: { _count: { select: { doctors: true, appointments: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.appointment.findMany({
        where: { hospitalId, createdAt: { gte: last7 }, ...doctorFilter },
        include: {
          patient: { include: { user: { select: { firstName: true, lastName: true } } } },
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const lowStock = lowStockMedicines
      .map((m) => {
        const inStock = m.batches.reduce((sum, b) => sum + b.quantity, 0);
        return { ...m, inStock, isLowStock: inStock <= m.reorderLevel };
      })
      .filter((m) => m.isLowStock);

    return {
      kpis: {
        patientsTotal,
        patientsToday,
        doctorsTotal,
        appointmentsToday,
        appointmentsPendingReview,
        revenueToday: Number(revenueToday._sum.amount || 0),
      },
      lowStockMedicines: lowStock.map((m) => ({
        id: m.id,
        name: m.name,
        inStock: m.inStock,
        reorderLevel: m.reorderLevel,
      })),
      departments: departments.map((d) => ({
        name: d.name,
        doctors: d._count.doctors,
        appointments: d._count.appointments,
      })),
      recentActivity: recentActivity.map((a) => ({
        id: a.id,
        type: a.status,
        patient: `${a.patient.user.firstName} ${a.patient.user.lastName}`,
        doctor: `${a.doctor.user.firstName} ${a.doctor.user.lastName}`, // firstName already carries "Dr."
        createdAt: a.createdAt,
      })),
    };
  }

  /** Daily revenue series between from and to (paid amounts). */
  async revenue(hospitalId: string, from?: string, to?: string) {
    const start = from ? new Date(from) : new Date(Date.now() - 29 * 24 * 3600 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = to ? new Date(to) : new Date();
    end.setHours(23, 59, 59, 999);

    const payments = await this.prisma.payment.findMany({
      where: {
        invoice: { hospitalId },
        paidAt: { gte: start, lte: end },
        status: 'COMPLETED',
      },
      select: { amount: true, paidAt: true },
    });

    const series: Record<string, number> = {};
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().split('T')[0];
      series[key] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const p of payments) {
      const key = new Date(p.paidAt).toISOString().split('T')[0];
      series[key] = Math.round(((series[key] || 0) + Number(p.amount)) * 100) / 100;
    }

    return {
      from: start.toISOString().split('T')[0],
      to: end.toISOString().split('T')[0],
      total: Math.round(payments.reduce((s, p) => s + Number(p.amount), 0) * 100) / 100,
      series: Object.entries(series).map(([date, amount]) => ({ date, amount })),
    };
  }

  /** Appointment volume per day for the last N days (default 14). */
  async appointmentVolume(hospitalId: string, days = 14) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const appointments = await this.prisma.appointment.findMany({
      where: { hospitalId, scheduledDate: { gte: start, lte: end }, deletedAt: null },
      select: { scheduledDate: true, status: true },
    });

    const series: Record<string, { total: number; completed: number; cancelled: number }> = {};
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().split('T')[0];
      series[key] = { total: 0, completed: 0, cancelled: 0 };
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const a of appointments) {
      const key = new Date(a.scheduledDate).toISOString().split('T')[0];
      if (!series[key]) continue;
      series[key].total += 1;
      if (a.status === 'COMPLETED') series[key].completed += 1;
      if (a.status === 'CANCELLED') series[key].cancelled += 1;
    }
    return Object.entries(series).map(([date, v]) => ({ date, ...v }));
  }

  /** New patient registrations per day for the last N days. */
  async patientGrowth(hospitalId: string, days = 14) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const patients = await this.prisma.patient.findMany({
      where: { hospitalId, createdAt: { gte: start } },
      select: { createdAt: true },
    });

    const series: Record<string, number> = {};
    const cursor = new Date(start);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    while (cursor <= today) {
      series[cursor.toISOString().split('T')[0]] = 0;
      cursor.setDate(cursor.getDate() + 1);
    }
    for (const p of patients) {
      const key = new Date(p.createdAt).toISOString().split('T')[0];
      if (series[key] !== undefined) series[key] += 1;
    }
    return Object.entries(series).map(([date, count]) => ({ date, count }));
  }
}
