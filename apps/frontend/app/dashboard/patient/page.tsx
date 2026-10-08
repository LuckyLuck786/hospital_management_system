'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { formatDate, formatTime, formatCurrency } from '@/lib/roles';
import Link from 'next/link';
import {
  CalendarDays,
  FileText,
  Pill,
  CreditCard,
  ChevronRight,
} from 'lucide-react';

export default function PatientDashboard() {
  const { user } = useAuthStore();

  const { data: appointments } = useQuery({
    queryKey: ['my-appointments'],
    queryFn: async () => (await api.get('/appointments?limit=20')).data.data,
  });

  const { data: records } = useQuery({
    queryKey: ['my-records-count'],
    queryFn: async () => {
      const me = await api.get('/auth/me');
      const patientId = me.data.data.patient?.id;
      if (!patientId) return [];
      return (await api.get(`/medical-records/patient/${patientId}`)).data.data;
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ['my-invoices-count'],
    queryFn: async () => (await api.get('/invoices?limit=50')).data.data,
  });

  const upcoming = (appointments || []).filter((a: any) => ['PENDING', 'CONFIRMED'].includes(a.status));
  const prescriptions = (records || []).flatMap((r: any) => r.prescriptions || []);
  const pendingBills = (invoices || []).filter((i: any) => i.status === 'FINALIZED').reduce((s: number, i: any) => s + Number(i.balanceAmount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Health Dashboard</h1>
        <p className="text-gray-500">Welcome back, {user?.firstName}</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Upcoming Appointments" value={upcoming.length} icon={CalendarDays} color="blue" />
        <StatCard label="Medical Records" value={records?.length || 0} icon={FileText} color="green" />
        <StatCard label="Prescriptions" value={prescriptions.length} icon={Pill} color="purple" />
        <StatCard label="Pending Bills" value={formatCurrency(pendingBills)} icon={CreditCard} color="orange" />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Recent Appointments</h2>
            <Link href="/dashboard/patient/book" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              Book New
            </Link>
          </div>
          {(appointments || []).length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No appointments yet</p>
              <Link href="/dashboard/patient/book" className="text-primary-600 text-sm mt-2 inline-block">
                Book your first appointment
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {(appointments || []).slice(0, 6).map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="min-w-0">
                    <p className="font-medium truncate">Dr. {apt.doctor?.user.lastName}</p>
                    <p className="text-sm text-gray-500">
                      {apt.department?.name} • {formatDate(apt.scheduledDate)} • {formatTime(apt.scheduledTime)}
                    </p>
                  </div>
                  <StatusBadge status={apt.status} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <Link href="/dashboard/patient/book" className="flex items-center justify-between p-4 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition-colors">
              <div className="flex items-center gap-3">
                <CalendarDays className="w-5 h-5" />
                <span className="font-medium">Book Appointment</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="/dashboard/patient/records" className="flex items-center justify-between p-4 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5" />
                <span className="font-medium">View Medical Records</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="/dashboard/patient/prescriptions" className="flex items-center justify-between p-4 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <Pill className="w-5 h-5" />
                <span className="font-medium">My Prescriptions</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
            <Link href="/dashboard/patient/bills" className="flex items-center justify-between p-4 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5" />
                <span className="font-medium">My Bills</span>
              </div>
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
