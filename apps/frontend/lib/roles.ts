export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  HOSPITAL_ADMIN: 'Hospital Admin',
  DOCTOR: 'Doctor',
  NURSE: 'Nurse',
  RECEPTIONIST: 'Receptionist',
  LAB_TECHNICIAN: 'Lab Technician',
  PHARMACIST: 'Pharmacist',
  ACCOUNTANT: 'Accountant',
  PATIENT: 'Patient',
};

export const ALL_ROLES = Object.keys(ROLE_LABELS);

export function roleLabel(role: string) {
  return ROLE_LABELS[role] || role.replace(/_/g, ' ');
}

export function formatCurrency(amount: number | string | null | undefined) {
  const value = Number(amount || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  }).format(value);
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function formatTime(time: string) {
  const [hours, minutes] = time.split(':');
  const h = parseInt(hours);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

/** Seeded doctor first names already carry "Dr." — normalise so it is shown exactly once. */
export function doctorName(user?: { firstName?: string; lastName?: string } | null) {
  if (!user) return 'Doctor';
  const first = (user.firstName || '').replace(/^dr\.?\s*/i, '');
  return `Dr. ${[first, user.lastName].filter(Boolean).join(' ')}`.trim();
}

/** Landing page per role after sign-in. */
export const ROLE_HOME: Record<string, string> = {
  SUPER_ADMIN: "/dashboard/admin",
  HOSPITAL_ADMIN: "/dashboard/admin",
  DOCTOR: "/dashboard/doctor",
  PATIENT: "/dashboard/patient",
  RECEPTIONIST: "/dashboard/receptionist",
  NURSE: "/dashboard/nurse",
  LAB_TECHNICIAN: "/dashboard/lab",
  PHARMACIST: "/dashboard/pharmacy",
  ACCOUNTANT: "/dashboard/accountant",
};
