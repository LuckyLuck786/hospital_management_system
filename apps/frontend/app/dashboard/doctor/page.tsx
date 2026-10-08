"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import Link from "next/link";
import {
  CalendarDays,
  Users,
  ClipboardList,
  Microscope,
  Pill,
  Activity,
  ArrowRight,
  Stethoscope,
} from "lucide-react";

export default function DoctorDashboard() {
  const { user } = useAuthStore();

  const { data: analytics } = useQuery({
    queryKey: ["doctor-analytics"],
    queryFn: async () => (await api.get("/analytics/dashboard")).data.data,
  });

  const { data: todayAppointments } = useQuery({
    queryKey: ["today-appointments"],
    queryFn: async () => (await api.get("/appointments/today")).data.data,
  });

  const { data: patientMeta } = useQuery({
    queryKey: ["doctor-patient-count"],
    queryFn: async () => (await api.get("/patients?limit=1")).data.meta,
  });

  const { data: pendingReports } = useQuery({
    queryKey: ["doctor-pending-lab"],
    queryFn: async () => (await api.get("/lab/orders?status=RESULT_UPLOADED")).data,
  });

  const { data: recentRx } = useQuery({
    queryKey: ["doctor-recent-rx"],
    queryFn: async () => (await api.get("/prescriptions")).data,
  });

  const pendingList = Array.isArray(pendingReports) ? pendingReports : pendingReports?.data || [];

  const stats = [
    {
      label: "Today's Appointments",
      value: analytics?.kpis?.appointmentsToday ?? todayAppointments?.length ?? 0,
      icon: CalendarDays,
      color: "bg-blue-500",
    },
    {
      label: "My Patients",
      value: patientMeta?.total || 0,
      icon: Users,
      color: "bg-green-500",
    },
    {
      label: "Pending Lab Approvals",
      value: analytics?.kpis?.appointmentsPendingReview ?? pendingList.length,
      icon: Microscope,
      color: "bg-yellow-500",
    },
    {
      label: "Prescriptions Written",
      value: Array.isArray(recentRx) ? recentRx.length : recentRx?.data?.length || 0,
      icon: Pill,
      color: "bg-purple-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Doctor Dashboard</h1>
        <p className="text-gray-500">Welcome back, Dr. {user?.lastName}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card flex items-center gap-4">
              <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Today's Appointments */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary-600" />
            Today&apos;s Appointments
          </h2>
          <span className="text-sm text-gray-500">{formatDate(new Date().toISOString())}</span>
        </div>

        {!todayAppointments ? (
          <p className="text-sm text-gray-400 py-4">Loading…</p>
        ) : todayAppointments.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No appointments scheduled for today</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {todayAppointments.map((apt: any) => (
              <div
                key={apt.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold">
                    {apt.patient?.user.firstName?.[0]}
                    {apt.patient?.user.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-medium">
                      {apt.patient?.user.firstName} {apt.patient?.user.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{apt.reason || "General Consultation"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatTime(apt.scheduledTime)}</p>
                  <p className="text-xs text-gray-500">{apt.duration} min</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Pending lab approvals */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Microscope className="w-5 h-5 text-yellow-500" />
              Lab Reports Awaiting Approval
            </h2>
            <Link href="/dashboard/doctor/lab-reports" className="text-sm text-primary-600 flex items-center gap-1 hover:text-primary-700">
              All reports <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {pendingList.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No pending lab approvals 🎉</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {pendingList.slice(0, 6).map((o: any) => (
                <div key={o.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {o.medicalRecord?.patient?.user.firstName} {o.medicalRecord?.patient?.user.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {o.orderNumber} · {o.tests?.length || 0} test(s)
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-yellow-700 bg-yellow-100 px-2 py-1 rounded-full shrink-0">
                    Review
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent prescriptions */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Pill className="w-5 h-5 text-purple-500" />
              Recent Prescriptions
            </h2>
            <Link href="/dashboard/doctor/prescriptions" className="text-sm text-primary-600 flex items-center gap-1 hover:text-primary-700">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {!recentRx ? (
            <p className="text-sm text-gray-400 py-4">Loading…</p>
          ) : recentRx.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No prescriptions yet</p>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto">
              {(Array.isArray(recentRx) ? recentRx : recentRx.data || []).slice(0, 6).map((rx: any) => (
                <div key={rx.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {rx.medicalRecord?.patient?.user.firstName} {rx.medicalRecord?.patient?.user.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {rx.prescriptionNumber} · {rx.items?.length} item(s)
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${
                      rx.isDispensed ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {rx.isDispensed ? "Dispensed" : "Pending"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          href="/dashboard/doctor/appointments"
          className="card flex items-center gap-4 hover:shadow-md transition-shadow group"
        >
          <div className="w-11 h-11 bg-primary-100 rounded-xl flex items-center justify-center group-hover:bg-primary-200 transition-colors">
            <ClipboardList className="w-5 h-5 text-primary-700" />
          </div>
          <div>
            <p className="font-semibold">Start Consultation</p>
            <p className="text-sm text-gray-500">EMR + prescription flow</p>
          </div>
        </Link>
        <Link
          href="/dashboard/doctor/patients"
          className="card flex items-center gap-4 hover:shadow-md transition-shadow group"
        >
          <div className="w-11 h-11 bg-green-100 rounded-xl flex items-center justify-center group-hover:bg-green-200 transition-colors">
            <Users className="w-5 h-5 text-green-700" />
          </div>
          <div>
            <p className="font-semibold">Patient History</p>
            <p className="text-sm text-gray-500">Records & past visits</p>
          </div>
        </Link>
        <Link
          href="/dashboard/doctor/lab-reports"
          className="card flex items-center gap-4 hover:shadow-md transition-shadow group"
        >
          <div className="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center group-hover:bg-purple-200 transition-colors">
            <Stethoscope className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <p className="font-semibold">Lab Reports</p>
            <p className="text-sm text-gray-500">Review patient results</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
