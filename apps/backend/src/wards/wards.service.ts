import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { BedStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

const BED_INCLUDE = {
  patient: {
    select: {
      id: true,
      patientId: true,
      user: { select: { firstName: true, lastName: true, gender: true, dateOfBirth: true } },
    },
  },
} satisfies Prisma.BedInclude;

@Injectable()
export class WardsService {
  constructor(private prisma: PrismaService) {}

  /** Rooms grouped by department with every bed and the patient in it. */
  async overview(hospitalId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { hospitalId, isActive: true },
      include: {
        department: { select: { id: true, name: true } },
        beds: { include: BED_INCLUDE, orderBy: { label: 'asc' } },
      },
      orderBy: [{ roomNumber: 'asc' }],
    });
    const byDept = new Map<string, { department: string; departmentId: string | null; totalBeds: number; occupiedBeds: number; rooms: any[] }>();
    for (const r of rooms) {
      const key = r.department?.id ?? 'unassigned';
      if (!byDept.has(key)) {
        byDept.set(key, { department: r.department?.name ?? 'General', departmentId: r.department?.id ?? null, totalBeds: 0, occupiedBeds: 0, rooms: [] });
      }
      const g = byDept.get(key)!;
      g.totalBeds += r.beds.length;
      g.occupiedBeds += r.beds.filter((b) => b.status === BedStatus.OCCUPIED).length;
      g.rooms.push({ ...r, capacity: r.beds.length, occupiedBeds: r.beds.filter((b) => b.status === BedStatus.OCCUPIED).length });
    }
    const wards = [...byDept.values()].sort((a, b) => a.department.localeCompare(b.department));
    const totalBeds = wards.reduce((s, w) => s + w.totalBeds, 0);
    const occupiedBeds = wards.reduce((s, w) => s + w.occupiedBeds, 0);
    return { totalBeds, occupiedBeds, occupancyRate: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0, wards };
  }

  /** Inpatients currently in a bed. */
  async admissions(hospitalId: string) {
    return this.prisma.bed.findMany({
      where: { hospitalId, patientId: { not: null } },
      include: { ...BED_INCLUDE, room: { select: { roomNumber: true, type: true, department: { select: { name: true } } } } },
      orderBy: { admittedAt: 'desc' },
    });
  }

  async createRoom(hospitalId: string, data: any) {
    if (!data?.roomNumber || !data?.type) throw new BadRequestException('roomNumber and type are required');
    const capacity = Math.min(40, Math.max(1, Number(data.capacity) || 1));
    return this.prisma.room.create({
      data: {
        hospitalId,
        roomNumber: String(data.roomNumber),
        type: String(data.type),
        capacity,
        departmentId: data.departmentId || null,
        beds: { create: Array.from({ length: capacity }, (_, i) => ({ hospitalId, label: `Bed ${i + 1}` })) },
      },
      include: { beds: true },
    });
  }

  private async loadBed(id: string, hospitalId: string, user: any) {
    const bed = await this.prisma.bed.findUnique({ where: { id } });
    if (!bed) throw new NotFoundException('Bed not found');
    if (user.role !== 'SUPER_ADMIN' && bed.hospitalId !== hospitalId) throw new ForbiddenException('Access denied');
    return bed;
  }

  /** Keep the room's cached counters in step with its beds. */
  private async syncRoom(roomId: string) {
    const occupied = await this.prisma.bed.count({ where: { roomId, status: BedStatus.OCCUPIED } });
    await this.prisma.room.update({ where: { id: roomId }, data: { occupiedBeds: occupied, isOccupied: occupied > 0 } });
  }

  async admit(bedId: string, hospitalId: string, user: any, data: { patientId?: string; notes?: string }) {
    const bed = await this.loadBed(bedId, hospitalId, user);
    if (bed.status !== BedStatus.AVAILABLE) throw new ConflictException('This bed is not available');
    if (!data?.patientId) throw new BadRequestException('patientId is required');
    const patient = await this.prisma.patient.findFirst({ where: { id: data.patientId, deletedAt: null } });
    if (!patient || patient.hospitalId !== bed.hospitalId) throw new NotFoundException('Patient not found in this hospital');
    const current = await this.prisma.bed.findUnique({ where: { patientId: patient.id }, include: { room: { select: { roomNumber: true } } } });
    if (current) throw new ConflictException(`Patient is already admitted to ${current.room.roomNumber} ${current.label}`);
    try {
      const updated = await this.prisma.bed.update({
        where: { id: bedId },
        data: { patientId: patient.id, status: BedStatus.OCCUPIED, admittedAt: new Date(), admissionNotes: data.notes || null },
        include: BED_INCLUDE,
      });
      await this.syncRoom(bed.roomId);
      return updated;
    } catch (e) {
      // unique(patientId) guards against two simultaneous admissions of the same patient
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new ConflictException('Patient is already admitted');
      throw e;
    }
  }

  /** Discharge frees the patient; the bed goes to CLEANING until housekeeping marks it ready. */
  async discharge(bedId: string, hospitalId: string, user: any) {
    const bed = await this.loadBed(bedId, hospitalId, user);
    if (bed.status !== BedStatus.OCCUPIED) throw new BadRequestException('Bed is not occupied');
    const updated = await this.prisma.bed.update({
      where: { id: bedId },
      data: { patientId: null, status: BedStatus.CLEANING, admittedAt: null, admissionNotes: null },
    });
    await this.syncRoom(bed.roomId);
    return updated;
  }

  async setStatus(bedId: string, hospitalId: string, user: any, status: BedStatus) {
    const bed = await this.loadBed(bedId, hospitalId, user);
    const allowed: BedStatus[] = [BedStatus.AVAILABLE, BedStatus.CLEANING, BedStatus.MAINTENANCE];
    if (!allowed.includes(status)) throw new BadRequestException('Use admit/discharge to change occupancy');
    if (bed.status === BedStatus.OCCUPIED) throw new BadRequestException('Discharge the patient first');
    const updated = await this.prisma.bed.update({ where: { id: bedId }, data: { status } });
    await this.syncRoom(bed.roomId);
    return updated;
  }
}
