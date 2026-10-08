import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class MedicinesService {
  constructor(private prisma: PrismaService) {}

  async findAll(hospitalId: string, search?: string, page = 1, limit = 50) {
    const where: any = { hospitalId, isActive: true };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [medicines, total] = await Promise.all([
      this.prisma.medicine.findMany({
        where,
        include: {
          _count: { select: { batches: true } },
          batches: {
            where: { isQuarantined: false },
            orderBy: { expiryDate: 'asc' },
            take: 5,
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.medicine.count({ where }),
    ]);

    const data = medicines.map((m) => {
      const inStock = m.batches.reduce((sum, b) => sum + b.quantity, 0);
      return {
        ...m,
        inStock,
        isLowStock: inStock <= m.reorderLevel,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string) {
    const medicine = await this.prisma.medicine.findUnique({
      where: { id },
      include: { batches: { orderBy: { expiryDate: 'asc' } } },
    });
    if (!medicine) throw new NotFoundException('Medicine not found');
    const inStock = medicine.batches.reduce((sum, b) => sum + b.quantity, 0);
    return { ...medicine, inStock, isLowStock: inStock <= medicine.reorderLevel };
  }

  async create(hospitalId: string, data: any) {
    return this.prisma.medicine.create({
      data: {
        hospitalId,
        name: data.name,
        genericName: data.genericName || data.name,
        form: data.form || 'TABLET',
        manufacturer: data.manufacturer || 'Generic',
        category: data.category,
        description: data.description,
        sideEffects: data.sideEffects,
        contraindications: data.contraindications,
        unitPrice: data.unitPrice,
        mrp: data.mrp || data.unitPrice,
        reorderLevel: data.reorderLevel || 10,
      },
    });
  }

  async addBatch(medicineId: string, data: any) {
    const medicine = await this.prisma.medicine.findUnique({ where: { id: medicineId } });
    if (!medicine) throw new NotFoundException('Medicine not found');

    const expiryDate = new Date(data.expiryDate);
    if (expiryDate <= new Date()) {
      throw new BadRequestException('Cannot add a batch that is already expired');
    }

    return this.prisma.medicineBatch.create({
      data: {
        medicineId,
        batchNumber: data.batchNumber,
        manufacturingDate: new Date(data.manufacturingDate) || new Date(),
        expiryDate,
        quantity: data.quantity,
        unitCost: data.unitCost,
        mrp: data.mrp || medicine.mrp,
        supplier: data.supplier,
      },
    });
  }
}
