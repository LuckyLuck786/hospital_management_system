import { describe, expect, it } from 'vitest';
import { doctorName, formatCurrency, formatTime, roleLabel, ROLE_HOME } from '@/lib/roles';

describe('lib/roles helpers', () => {
  it('shows the "Dr." prefix exactly once', () => {
    expect(doctorName({ firstName: 'Dr. Rajesh', lastName: 'Sharma' })).toBe('Dr. Rajesh Sharma');
    expect(doctorName({ firstName: 'Priya', lastName: 'Patel' })).toBe('Dr. Priya Patel');
    expect(doctorName(null)).toBe('Doctor');
  });

  it('formats rupees and 12-hour times', () => {
    expect(formatCurrency(1500)).toBe('₹1,500');
    expect(formatCurrency('99.5')).toBe('₹99.50');
    expect(formatTime('09:30')).toBe('9:30 AM');
    expect(formatTime('14:05')).toBe('2:05 PM');
    expect(formatTime('00:15')).toBe('12:15 AM');
  });

  it('maps every role to a label and a home page', () => {
    expect(roleLabel('LAB_TECHNICIAN')).toBe('Lab Technician');
    expect(roleLabel('SOMETHING_NEW')).toBe('SOMETHING NEW');
    for (const role of ['SUPER_ADMIN', 'HOSPITAL_ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'LAB_TECHNICIAN', 'PHARMACIST', 'ACCOUNTANT', 'PATIENT']) {
      expect(ROLE_HOME[role]).toMatch(/^\/dashboard\//);
    }
  });
});
