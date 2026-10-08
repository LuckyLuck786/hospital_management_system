"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, EmptyState } from "@/components/shared/states";
import { formatTime } from "@/lib/roles";
import { CalendarDays, Users, HeartPulse, Clock } from "lucide-react";

export default function NurseDashboard() {
  const { user } = useAuthStore();

  const { data: today } = useQuery({
    queryKey: ["nurse-today"],
    queryFn: async () => (await api.get("/appointments/today")).data.data,
  });

  const { data: patients } = useQuery({
    queryKey: ["nurse-patients"],
    queryFn: async () => (await api.get("/patients?limit=1")).data.meta,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nurse Station</h1>
        <p className="text-gray-500">Welcome, {user?.firstName}. Today's ward overview.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Today's Appointments" value={today?.length || 0} icon={CalendarDays} color="blue" />
        <StatCard label="Registered Patients" value={patients?.total || 0} icon={Users} color="green" />
        <StatCard label="In Progress" value={today?.filter((a: any) => a.status === "IN_PROGRESS").length || 0} icon={HeartPulse} color="purple" />
        <StatCard label="Pending" value={today?.filter((a: any) => ["PENDING", "CONFIRMED"].includes(a.status)).length || 0} icon={Clock} color="yellow" />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary-600" /> Today's Schedule
        </h2>
        {!today ? (
          <LoadingState />
        ) : today.length === 0 ? (
          <EmptyState title="No appointments today" />
        ) : (
          <div className="space-y-3">
            {today.map((apt: any) => (
              <div key={apt.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="text-center w-16">
                    <p className="font-bold text-primary-700">{formatTime(apt.scheduledTime)}</p>
                  </div>
                  <div className="w-px h-10 bg-gray-300" />
                  <div>
                    <p className="font-medium">
                      {apt.patient?.user.firstName} {apt.patient?.user.lastName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Dr. {apt.doctor?.user.lastName} • {apt.department?.name}
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
  );
}
