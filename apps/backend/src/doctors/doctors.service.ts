import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { RedisService } from '../common/redis.service';

/** Slots change on every booking, so keep the cache short (PRD §3: 60 s). */
export const AVAILABILITY_TTL_SECONDS = 60;
export const availabilityKey = (doctorId: string, date: string) => `avail:${doctorId}:${date}`;

@Injectable()
export class DoctorsService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async findAll(
    hospitalId: string,
    specialization?: string,
    departmentId?: string,
    isAvailable?: boolean,
  ) {
    const where: any = { hospitalId };
    if (specialization) where.specialization = { contains: specialization, mode: 'insensitive' };
    if (departmentId) where.departmentId = departmentId;
    if (isAvailable !== undefined) where.isAvailable = isAvailable;

    return this.prisma.doctor.findMany({
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
          },
        },
        department: { select: { id: true, name: true } },
      },
      orderBy: { user: { firstName: 'asc' } },
    });
  }

  async findById(id: string) {
    const doctor = await this.prisma.doctor.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            gender: true,
            dateOfBirth: true,
          },
        },
        department: true,
        hospital: { select: { id: true, name: true } },
      },
    });
    if (!doctor) throw new NotFoundException('Doctor not found');
    return doctor;
  }

  async getAvailability(id: string, date?: string) {
    const cacheKey = availabilityKey(id, (date ? new Date(date) : new Date()).toISOString().split('T')[0]);
    const cached = await this.redis.get(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached);
    const result = await this.computeAvailability(id, date);
    await this.redis.setex(cacheKey, AVAILABILITY_TTL_SECONDS, JSON.stringify(result)).catch(() => undefined);
    return result;
  }

  private async computeAvailability(id: string, date?: string) {
    const doctor = await this.findById(id);
    const weeklySchedule = (doctor.weeklySchedule as any) || {};
    const targetDate = date ? new Date(date) : new Date();
    const dayOfWeek = targetDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    const existingAppointments = await this.prisma.appointment.findMany({
      where: {
        doctorId: id,
        scheduledDate: targetDate,
        status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] },
      },
      select: { scheduledTime: true, duration: true },
    });

    const bookedSlots = existingAppointments.map((a) => a.scheduledTime);
    const daySchedule = weeklySchedule[dayOfWeek] || [];
    const availableSlots = [];

    for (const slot of daySchedule) {
      const startTime = this.parseTime(slot.start);
      const endTime = this.parseTime(slot.end);
      const slotDuration = slot.slotDuration || 30;
      let currentTime = startTime;

      while (currentTime < endTime) {
        const timeStr = this.formatTime(currentTime);
        if (!bookedSlots.includes(timeStr)) {
          availableSlots.push({ time: timeStr, duration: slotDuration, isAvailable: true });
        }
        currentTime += slotDuration;
      }
    }

    return {
      doctorId: id,
      date: targetDate.toISOString().split('T')[0],
      dayOfWeek,
      slots: availableSlots,
    };
  }

  async updateSchedule(id: string, schedule: any) {
    return this.prisma.doctor.update({
      where: { id },
      data: { weeklySchedule: schedule },
    });
  }

  private parseTime(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  private formatTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
}
