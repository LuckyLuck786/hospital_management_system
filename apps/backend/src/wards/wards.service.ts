import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class WardsService {
  constructor(private prisma: PrismaService) {}

  /** Rooms grouped by department with bed counts. */
  async overview(hospitalId: string) {
    const rooms = await this.prisma.room.findMany({
      where: { hospitalId, isActive: true },
      include: { department: { select: { id: true, name: true } } },
      orderBy: [{ roomNumber: 'asc' }],
    });
    const byDept = new Map<string, { department: string; departmentId: string | null; totalBeds: number; occupiedBeds: number; rooms: any[] }>();
    for (const r of rooms) {
      const key = r.department?.id ?? 'unassigned';
      if (!byDept.has(key)) {
        byDept.set(key, { department: r.department?.name ?? 'General', departmentId: r.department?.id ?? null, totalBeds: 0, occupiedBeds: 0, rooms: [] });
      }
      const g = byDept.get(key)!;
      g.totalBeds += r.capacity;
      g.occupiedBeds += r.occupiedBeds;
      g.rooms.push(r);
    }
    const wards = [...byDept.values()].sort((a, b) => a.department.localeCompare(b.department));
    const totalBeds = wards.reduce((s, w) => s + w.totalBeds, 0);
    const occupiedBeds = wards.reduce((s, w) => s + w.occupiedBeds, 0);
    return { totalBeds, occupiedBeds, occupancyRate: totalBeds ? Math.round((occupiedBeds / totalBeds) * 100) : 0, wards };
  }

  async createRoom(hospitalId: string, data: any) {
    if (!data?.roomNumber || !data?.type) throw new BadRequestException('roomNumber and type are required');
    const capacity = Math.max(1, Number(data.capacity) || 1);
    return this.prisma.room.create({
      data: {
        hospitalId,
        roomNumber: String(data.roomNumber),
        type: String(data.type),
        capacity,
        departmentId: data.departmentId || null,
      },
    });
  }

  async setOccupancy(id: string, hospitalId: string, user: any, occupiedBeds: number) {
    const room = await this.prisma.room.findUnique({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    if (user.role !== 'SUPER_ADMIN' && room.hospitalId !== hospitalId) throw new ForbiddenException('Access denied');
    const n = Number(occupiedBeds);
    if (!Number.isInteger(n) || n < 0 || n > room.capacity) {
      throw new BadRequestException(`occupiedBeds must be between 0 and ${room.capacity}`);
    }
    return this.prisma.room.update({ where: { id }, data: { occupiedBeds: n, isOccupied: n > 0 } });
  }
}
