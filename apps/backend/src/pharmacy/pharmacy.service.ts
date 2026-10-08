import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { NotificationType } from '@prisma/client';

@Injectable()
export class PharmacyService {
  constructor(private prisma: PrismaService) {}

  /** Prescriptions waiting to be fulfilled at the pharmacy. */
  async pendingPrescriptions(hospitalId: string) {
    const prescriptions = await this.prisma.prescription.findMany({
      where: { hospitalId, isDispensed: false },
      include: {
        items: {
          include: {
            medicine: {
              include: {
                batches: {
                  where: { isQuarantined: false, isExpired: false },
                  select: { quantity: true },
                },
              },
            },
          },
        },
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        medicalRecord: {
          include: {
            patient: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return prescriptions.map((p) => {
      const items = p.items.map((item) => ({
        ...item,
        inStock: item.medicine.batches.reduce((sum, b) => sum + b.quantity, 0),
      }));
      return { ...p, items };
    });
  }

  /** Medicines whose available stock is at or below their reorder level. */
  async lowStock(hospitalId: string) {
    const medicines = await this.prisma.medicine.findMany({
      where: { hospitalId, isActive: true },
      include: {
        batches: {
          where: { isQuarantined: false, isExpired: false },
          select: { quantity: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return medicines
      .map((m) => {
        const inStock = m.batches.reduce((sum, b) => sum + b.quantity, 0);
        return { ...m, inStock, isLowStock: inStock <= m.reorderLevel };
      })
      .filter((m) => m.isLowStock);
  }

  /** Fulfil a prescription: consume stock FIFO (oldest batch first), flag stockouts. */
  async dispense(hospitalId: string, userId: string, prescriptionId: string) {
    const prescription = await this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        items: { include: { medicine: true } },
        medicalRecord: { include: { appointment: { select: { id: true } }, patient: true } },
      },
    });
    if (!prescription) throw new NotFoundException('Prescription not found');
    if (prescription.hospitalId !== hospitalId) throw new ForbiddenException('Access denied');
    if (prescription.isDispensed) {
      throw new BadRequestException('This prescription has already been dispensed');
    }
    if (!prescription.items.length) {
      throw new BadRequestException('Prescription has no items to dispense');
    }

    const dispensed: Array<{
      medicineId: string;
      name: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    await this.prisma.$transaction(async (tx) => {
      for (const item of prescription.items) {
        const dosesPerDay = this.dosesPerDay(item.frequency);
        const qtyNeeded = (item.duration || 1) * dosesPerDay;

        // FIFO: consume the batches expiring first
        const batches = await tx.medicineBatch.findMany({
          where: {
            medicineId: item.medicineId,
            isQuarantined: false,
            isExpired: false,
            quantity: { gt: 0 },
          },
          orderBy: [{ expiryDate: 'asc' }, { createdAt: 'asc' }],
        });

        let remaining = qtyNeeded;
        for (const batch of batches) {
          if (remaining <= 0) break;
          const take = Math.min(batch.quantity, remaining);
          await tx.medicineBatch.update({
            where: { id: batch.id },
            data: { quantity: { decrement: take } },
          });
          remaining -= take;
        }

        if (remaining > 0) {
          throw new BadRequestException(
            `Insufficient stock for ${item.medicine.name} (short by ${remaining} unit${remaining > 1 ? 's' : ''})`,
          );
        }

        const totalPrice = Number(item.medicine.unitPrice) * qtyNeeded;
        dispensed.push({
          medicineId: item.medicineId,
          name: item.medicine.name,
          quantity: qtyNeeded,
          unitPrice: Number(item.medicine.unitPrice),
          totalPrice: Math.round(totalPrice * 100) / 100,
        });
      }

      await tx.prescription.update({
        where: { id: prescriptionId },
        data: { isDispensed: true, dispensedAt: new Date(), dispensedById: userId },
      });
    });

    // Add PHARMACY charges to the visit invoice
    const invoice = await this.prisma.invoice.findUnique({
      where: { appointmentId: prescription.medicalRecord.appointmentId },
    });
    if (invoice) {
      const medTotal = dispensed.reduce((sum, i) => sum + i.totalPrice, 0);
      await this.prisma.invoice.update({
        where: { id: invoice.id },
        data: {
          subtotal: { increment: medTotal },
          totalAmount: { increment: medTotal },
          balanceAmount: { increment: medTotal },
          items: {
            create: dispensed.map((i) => ({
              description: `Pharmacy: ${i.name}`,
              category: 'PHARMACY',
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
              referenceId: prescriptionId,
            })),
          },
        },
      });
    }

    // Notify the patient
    await this.prisma.notification.create({
      data: {
        userId: prescription.medicalRecord.patient.userId,
        hospitalId,
        type: NotificationType.PRESCRIPTION_READY,
        title: 'Prescription dispensed',
        message: `Your prescription ${prescription.prescriptionNumber} is ready — collected at the pharmacy.`,
        channels: ['IN_APP'],
        entityType: 'Prescription',
        entityId: prescriptionId,
        inAppSent: true,
      },
    });

    return this.prisma.prescription.findUnique({
      where: { id: prescriptionId },
      include: {
        items: { include: { medicine: true } },
        medicalRecord: {
          include: {
            patient: { include: { user: { select: { firstName: true, lastName: true } } } },
          },
        },
      },
    });
  }

  /** Rough daily dose for a frequency code, used to compute dispense quantity. */
  private dosesPerDay(frequency: string): number {
    const map: Record<string, number> = { OD: 1, BD: 2, TDS: 3, QID: 4, SOS: 1, HS: 1 };
    return map[(frequency || '').toUpperCase()] || 1;
  }
}
