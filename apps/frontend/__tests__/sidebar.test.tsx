import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAuthStore } from '@/store/auth-store';
import { DashboardSidebar } from '@/components/shared/dashboard-sidebar';

const asRole = (role: string) =>
  useAuthStore.setState({ user: { id: 'u', email: 'x@y.z', firstName: 'Test', lastName: 'User', role }, isAuthenticated: true });

const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));

describe('DashboardSidebar navigation per role', () => {
  beforeEach(() => useAuthStore.setState({ user: null, isAuthenticated: false }));

  it('pharmacists only see pharmacy pages (no patient registry they cannot open)', () => {
    asRole('PHARMACIST');
    render(<DashboardSidebar />);
    expect(hrefs()).toEqual(expect.arrayContaining(['/dashboard/pharmacy', '/dashboard/pharmacy/inventory', '/dashboard/settings']));
    expect(hrefs()).not.toContain('/dashboard/patients');
    expect(hrefs()).not.toContain('/dashboard/doctor/patients');
  });

  it('accountants get billing and insurance claims', () => {
    asRole('ACCOUNTANT');
    render(<DashboardSidebar />);
    expect(hrefs()).toEqual(expect.arrayContaining(['/dashboard/receptionist/billing', '/dashboard/insurance']));
  });

  it('hospital admins get wards, audit log and claims; patients get none of them', () => {
    asRole('HOSPITAL_ADMIN');
    const { unmount } = render(<DashboardSidebar />);
    expect(hrefs()).toEqual(expect.arrayContaining(['/dashboard/wards', '/dashboard/audit', '/dashboard/insurance']));
    unmount();
    asRole('PATIENT');
    render(<DashboardSidebar />);
    expect(hrefs()).not.toContain('/dashboard/audit');
    expect(hrefs()).not.toContain('/dashboard/wards');
    expect(screen.getByText('Bills & Payments')).toBeInTheDocument();
  });
});
