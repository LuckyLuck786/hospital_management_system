import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class SearchService {
  constructor(private prisma: PrismaService) {}

  async search(hospitalId: string, user: any, q: string, limit = 8) {
    if (!q || q.trim().length < 2) return { patients: [], doctors: [], medicines: [], appointments: [] };

    const staff = [
      UserRole.SUPER_ADMIN,
      UserRole.HOSPITAL_ADMIN,
      UserRole.DOCTOR,
      UserRole.NURSE,
      UserRole.RECEPTIONIST,
      UserRole.LAB_TECHNICIAN,
      UserRole.PHARMACIST,
      UserRole.ACCOUNTANT,
    ];
    if (!staff.includes(user.role)) throw new ForbiddenException('Access denied');

    const term = q.trim();
    const contains = { contains: term, mode: 'insensitive' as const };

    // Doctors are scoped to their own patients; other staff to the hospital
    let patientWhere: any = { hospitalId, deletedAt: null };
    let appointmentWhere: any = { hospitalId, deletedAt: null };
    if (user.role === UserRole.DOCTOR) {
      const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!doctor) return { patients: [], doctors: [], medicines: [], appointments: [] };
      patientWhere = { medicalRecords: { some: { doctorId: doctor.id } }, deletedAt: null };
      appointmentWhere = { ...appointmentWhere, doctorId: doctor.id };
    }

    const [patients, doctors, medicines, appointments] = await Promise.all([
      this.prisma.patient.findMany({
        where: {
          ...patientWhere,
          OR: [
            { patientId: { contains: term, mode: 'insensitive' } },
            { user: { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] } },
          ],
        },
        include: { user: { select: { firstName: true, lastName: true, email: true, phone: true } } },
        take: limit,
      }),
      this.prisma.doctor.findMany({
        where: {
          hospitalId,
          OR: [
            { user: { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }] } },
            { specialization: contains },
            { department: { name: contains } },
          ],
        },
        include: {
          user: { select: { firstName: true, lastName: true, email: true } },
          department: { select: { name: true } },
        },
        take: limit,
      }),
      this.prisma.medicine.findMany({
        where: {
          hospitalId,
          isActive: true,
          OR: [{ name: contains }, { genericName: contains }],
        },
        select: { id: true, name: true, genericName: true, form: true, unitPrice: true },
        take: limit,
      }),
      this.prisma.appointment.findMany({
        where: {
          ...appointmentWhere,
          OR: [
            { appointmentNumber: { contains: term, mode: 'insensitive' } },
            {
              patient: {
                user: { OR: [{ firstName: contains }, { lastName: contains }] },
              },
            },
          ],
        },
        include: {
          patient: { include: { user: { select: { firstName: true, lastName: true } } } },
          doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
        take: limit,
        orderBy: { scheduledDate: 'desc' },
      }),
    ]);

    return {
      patients: patients.map((p) => ({
        id: p.id,
        patientId: p.patientId,
        name: `${p.user.firstName} ${p.user.lastName}`,
        email: p.user.email,
        phone: p.user.phone,
      })),
      doctors: doctors.map((d) => ({
        id: d.id,
        name: `${d.user.firstName} ${d.user.lastName}`, // firstName already carries "Dr."
        email: d.user.email,
        specialization: d.specialization,
        department: d.department?.name,
      })),
      medicines: medicines.map((m) => ({ id: m.id, name: m.name, genericName: m.genericName, form: m.form, unitPrice: Number(m.unitPrice) })),
      appointments: appointments.map((a) => ({
        id: a.id,
        appointmentNumber: a.appointmentNumber,
        status: a.status,
        scheduledDate: a.scheduledDate,
        scheduledTime: a.scheduledTime,
        patient: `${a.patient.user.firstName} ${a.patient.user.lastName}`,
        doctor: `${a.doctor.user.firstName} ${a.doctor.user.lastName}`, // firstName already carries "Dr."
      })),
    };
  }
}
