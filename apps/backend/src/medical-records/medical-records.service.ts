import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class MedicalRecordsService {
  constructor(private prisma: PrismaService) {}

  /** Resolve the Patient profile belonging to the given user (if any). */
  private async findPatientByUserId(userId: string) {
    return this.prisma.patient.findUnique({ where: { userId } });
  }

  /** Resolve the Doctor profile belonging to the given user (if any). */
  private async findDoctorByUserId(userId: string) {
    return this.prisma.doctor.findUnique({ where: { userId } });
  }

  async findByPatient(patientId: string, user: any) {
    if (user.role === UserRole.PATIENT) {
      const patient = await this.findPatientByUserId(user.id);
      if (!patient || patient.id !== patientId) {
        throw new ForbiddenException('You can only view your own records');
      }
    }

    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) throw new NotFoundException('Patient not found');

    // Tenant isolation: non-super-admins can only access records of their own hospital
    if (user.role !== UserRole.SUPER_ADMIN && patient.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('You do not have access to this patient\'s records');
    }

    return this.prisma.medicalRecord.findMany({
      where: { patientId },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        appointment: { select: { scheduledDate: true, scheduledTime: true } },
        prescriptions: {
          include: {
            items: {
              include: { medicine: { select: { name: true, genericName: true, form: true } } },
            },
          },
        },
        labOrders: { select: { id: true, status: true, orderNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string, user: any) {
    const record = await this.prisma.medicalRecord.findUnique({
      where: { id },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        patient: {
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                gender: true,
                bloodGroup: true,
                dateOfBirth: true,
              },
            },
          },
        },
        appointment: true,
        prescriptions: {
          include: {
            items: {
              include: { medicine: { select: { name: true, genericName: true, form: true } } },
            },
          },
        },
        labOrders: {
          include: {
            tests: true,
            results: true,
            orderedBy: { select: { firstName: true, lastName: true } },
          },
        },
        attachments: true,
      },
    });

    if (!record) throw new NotFoundException('Medical record not found');

    // Tenant isolation
    if (user.role !== UserRole.SUPER_ADMIN && record.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }

    if (user.role === UserRole.PATIENT) {
      const patient = await this.findPatientByUserId(user.id);
      if (!patient || record.patientId !== patient.id) {
        throw new ForbiddenException('Access denied');
      }
    }

    return record;
  }

  async create(hospitalId: string, userId: string, data: any) {
    // Resolve the doctor profile for the authenticated user
    const doctor = await this.findDoctorByUserId(userId);
    if (!doctor) throw new ForbiddenException('Doctor profile not found for this account');

    const appointment = await this.prisma.appointment.findUnique({
      where: { id: data.appointmentId },
      include: { medicalRecord: true },
    });

    if (!appointment) throw new NotFoundException('Appointment not found');
    if (appointment.medicalRecord)
      throw new ForbiddenException('Medical record already exists for this appointment');

    // Doctors can only create records for their own appointments (tenant + ownership isolation)
    if (appointment.doctorId !== doctor.id) {
      throw new ForbiddenException('You can only create records for your own appointments');
    }

    // Global sequence so record numbers never collide with seeded records
    const recordCount = await this.prisma.medicalRecord.count();

    // Auto-calculate BMI
    let bmi = null;
    if (data.vitals?.height && data.vitals?.weight) {
      const heightM = data.vitals.height / 100;
      bmi = (data.vitals.weight / (heightM * heightM)).toFixed(2);
    }

    return this.prisma.medicalRecord.create({
      data: {
        recordNumber: `MR-${new Date().getFullYear()}-${String(recordCount + 1).padStart(5, '0')}`,
        hospitalId,
        appointmentId: data.appointmentId,
        patientId: appointment.patientId,
        doctorId: doctor.id,
        vitalsBloodPressureSystolic: data.vitals?.bloodPressureSystolic,
        vitalsBloodPressureDiastolic: data.vitals?.bloodPressureDiastolic,
        vitalsPulse: data.vitals?.pulse,
        vitalsTemperature: data.vitals?.temperature,
        vitalsSpO2: data.vitals?.spO2,
        vitalsHeight: data.vitals?.height,
        vitalsWeight: data.vitals?.weight,
        vitalsBmi: bmi ? parseFloat(bmi) : null,
        chiefComplaint: data.chiefComplaint,
        symptoms: data.symptoms,
        diagnosis: data.diagnosis,
        differentialDiagnosis: data.differentialDiagnosis,
        treatmentPlan: data.treatmentPlan,
        allergies: data.allergies,
        notes: data.notes,
        icd10Code: data.icd10Code,
      },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        patient: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
    });
  }

  async update(id: string, data: any, user: any) {
    const record = await this.prisma.medicalRecord.findUnique({ where: { id } });
    if (!record) throw new NotFoundException('Medical record not found');

    // Tenant isolation
    if (user.role !== UserRole.SUPER_ADMIN && record.hospitalId !== user.hospitalId) {
      throw new ForbiddenException('Access denied');
    }

    // Only the attending doctor (or a hospital admin of the same hospital) may update
    if (user.role !== UserRole.HOSPITAL_ADMIN && user.role !== UserRole.SUPER_ADMIN) {
      const doctor = await this.findDoctorByUserId(user.id);
      if (!doctor || record.doctorId !== doctor.id) {
        throw new ForbiddenException('Only the attending doctor can update this record');
      }
    }

    const updateData: any = {};
    if (data.vitals) {
      if (data.vitals.bloodPressureSystolic !== undefined)
        updateData.vitalsBloodPressureSystolic = data.vitals.bloodPressureSystolic;
      if (data.vitals.bloodPressureDiastolic !== undefined)
        updateData.vitalsBloodPressureDiastolic = data.vitals.bloodPressureDiastolic;
      if (data.vitals.pulse !== undefined) updateData.vitalsPulse = data.vitals.pulse;
      if (data.vitals.temperature !== undefined)
        updateData.vitalsTemperature = data.vitals.temperature;
      if (data.vitals.spO2 !== undefined) updateData.vitalsSpO2 = data.vitals.spO2;
      if (data.vitals.height !== undefined) updateData.vitalsHeight = data.vitals.height;
      if (data.vitals.weight !== undefined) updateData.vitalsWeight = data.vitals.weight;
      if (data.vitals.height && data.vitals.weight) {
        const heightM = data.vitals.height / 100;
        updateData.vitalsBmi = parseFloat((data.vitals.weight / (heightM * heightM)).toFixed(2));
      }
    }
    if (data.chiefComplaint !== undefined) updateData.chiefComplaint = data.chiefComplaint;
    if (data.symptoms !== undefined) updateData.symptoms = data.symptoms;
    if (data.diagnosis !== undefined) updateData.diagnosis = data.diagnosis;
    if (data.differentialDiagnosis !== undefined)
      updateData.differentialDiagnosis = data.differentialDiagnosis;
    if (data.treatmentPlan !== undefined) updateData.treatmentPlan = data.treatmentPlan;
    if (data.allergies !== undefined) updateData.allergies = data.allergies;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.icd10Code !== undefined) updateData.icd10Code = data.icd10Code;

    return this.prisma.medicalRecord.update({
      where: { id },
      data: updateData,
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        patient: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
    });
  }
}
