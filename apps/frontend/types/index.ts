export interface Appointment {
  id: string;
  appointmentNumber: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  reason?: string;
  isEmergency: boolean;
  doctor?: {
    user: { firstName: string; lastName: string };
  };
  patient?: {
    user: { firstName: string; lastName: string };
  };
  department?: {
    name: string;
  };
}

export interface Doctor {
  id: string;
  specialization: string;
  qualification?: string;
  experienceYears?: number;
  consultationFee?: number;
  isAvailable: boolean;
  user: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  department?: {
    id: string;
    name: string;
  };
}

export interface Department {
  id: string;
  name: string;
  code?: string;
  description?: string;
}

export interface MedicalRecord {
  id: string;
  recordNumber: string;
  chiefComplaint?: string;
  symptoms?: string;
  diagnosis?: string;
  treatmentPlan?: string;
  allergies?: string;
  notes?: string;
  vitalsBloodPressureSystolic?: number;
  vitalsBloodPressureDiastolic?: number;
  vitalsPulse?: number;
  vitalsTemperature?: number;
  vitalsSpO2?: number;
  vitalsHeight?: number;
  vitalsWeight?: number;
  vitalsBmi?: number;
  createdAt: string;
  doctor?: { firstName: string; lastName: string };
}
