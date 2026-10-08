"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState } from "@/components/shared/states";
import { formatDate, formatCurrency } from "@/lib/roles";
import {
  Users,
  Stethoscope,
  CalendarDays,
  TrendingUp,
  AlertTriangle,
  Activity,
  ArrowRight,
  Pill,
  Microscope,
} from "lucide-react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const CHART_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#8b5cf6"];

export default function AdminDashboard() {
  const { user } = useAuthStore();

  const { data: dash, isLoading: dashLoading } = useQuery({
    queryKey: ["admin-analytics"],
    queryFn: async () => (await api.get("/analytics/dashboard")).data.data,
  });

  const { data: revenue } = useQuery({
    queryKey: ["admin-revenue"],
    queryFn: async () => (await api.get("/analytics/revenue")).data.data,
  });

  const { data: volume } = useQuery({
    queryKey: ["admin-volume"],
    queryFn: async () => (await api.get("/analytics/appointment-volume?days=7")).data.data,
  });

  const { data: todayAppointments } = useQuery({
    queryKey: ["admin-today"],
    queryFn: async () => (await api.get("/appointments/today")).data.data,
  });

  const kpis = dash?.kpis;
  const stats = [
    { label: "Total Patients", value: kpis?.patientsTotal || 0, icon: Users, color: "blue" },
    { label: "Active Doctors", value: kpis?.doctorsTotal || 0, icon: Stethoscope, color: "green" },
    { label: "Today's Appointments", value: kpis?.appointmentsToday || 0, icon: CalendarDays, color: "purple" },
    { label: "Revenue Today", value: formatCurrency(kpis?.revenueToday || 0), icon: TrendingUp, color: "orange" },
  ];

  const deptData = (dash?.departments || []).map((d: any) => ({
    name: d.name,
    value: d.doctors,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Hospital Admin Dashboard</h1>
        <p className="text-gray-500">
          Welcome back, {user?.firstName} · {formatDate(new Date().toISOString())}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} icon={stat.icon} color={stat.color} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Revenue trend */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Revenue Trend (30 days)</h2>
            <span className="text-sm font-semibold text-emerald-600">
              {formatCurrency(revenue?.total || 0)} total
            </span>
          </div>
          {!revenue ? (
            <LoadingState />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenue.series} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(d: string) => d.slice(5)} minTickGap={28} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), "Revenue"]} labelFormatter={(l: string) => formatDate(l)} />
                  <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2} fill="url(#revGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Appointment volume */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Appointments (last 7 days)</h2>
            <span className="text-sm text-gray-500">Total vs completed</span>
          </div>
          {!volume ? (
            <LoadingState />
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={volume} margin={{ top: 5, right: 5, left: -25, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(d: string) => d.slice(5)} minTickGap={28} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip labelFormatter={(l: string) => formatDate(l)} />
                  <Bar dataKey="total" name="Booked" fill="#4f46e5" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#10b981" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Department distribution */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Doctors by Department</h2>
            <Link href="/dashboard/admin/doctors" className="text-sm text-primary-600 flex items-center gap-1 hover:text-primary-700">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          {!dash ? (
            <LoadingState />
          ) : (
            <div className="flex items-center gap-4 h-64">
              <div className="flex-1 h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deptData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {deptData.map((_: any, i: number) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-44 space-y-2.5">
                {deptData.map((d: any, i: number) => (
                  <div key={d.name} className="flex items-center gap-2 text-sm">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                    <span className="truncate flex-1">{d.name}</span>
                    <span className="font-semibold text-gray-700">{d.value}</span>
                  </div>
                ))}
                {deptData.length === 0 && <p className="text-sm text-gray-400">No departments yet</p>}
              </div>
            </div>
          )}
        </div>

        {/* Today's appointments */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Today's Appointments</h2>
            <span className="text-sm text-gray-500">{formatDate(new Date().toISOString())}</span>
          </div>
          {!todayAppointments ? (
            <LoadingState />
          ) : todayAppointments.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No appointments today</div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {todayAppointments.map((apt: any) => (
                <div key={apt.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-semibold shrink-0">
                      {apt.patient?.user.firstName?.[0]}
                      {apt.patient?.user.lastName?.[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {apt.patient?.user.firstName} {apt.patient?.user.lastName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {apt.scheduledTime} · Dr. {apt.doctor?.user.lastName}
                      </p>
                    </div>
                  </div>
                  <StatusBadge status={apt.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Low stock + recent activity */}
      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Pill className="w-5 h-5 text-amber-500" /> Low Stock Alerts
          </h2>
          {dashLoading ? (
            <LoadingState />
          ) : (dash?.lowStockMedicines || []).length === 0 ? (
            <p className="text-sm text-gray-400">All medicines above reorder level 🎉</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {(dash?.lowStockMedicines || []).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-gray-500">Reorder at {m.reorderLevel} units</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-amber-600">{m.inStock} left</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-600" /> Recent Activity
          </h2>
          {dashLoading ? (
            <LoadingState />
          ) : (dash?.recentActivity || []).length === 0 ? (
            <p className="text-sm text-gray-400">No recent activity</p>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {(dash?.recentActivity || []).map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                    <Microscope className="w-4 h-4 text-primary-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{a.patient}</p>
                    <p className="text-xs text-gray-500 truncate">with {a.doctor}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <StatusBadge status={a.type} />
                    <span className="text-xs text-gray-400">{formatDate(a.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
