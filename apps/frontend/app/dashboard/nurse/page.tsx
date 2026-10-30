"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, EmptyState } from "@/components/shared/states";
import { RecordVitalsModal } from "@/components/modules/record-vitals-modal";
import { doctorName, formatTime } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { ArrowRight, BedDouble, CalendarDays, Clock, HeartPulse, Users } from "lucide-react";

export default function NurseDashboard() {
  const { user } = useAuthStore();
  const [triage, setTriage] = useState<any>(null);
  const [recorded, setRecorded] = useState<Set<string>>(new Set());

  const { data: today } = useQuery({
    queryKey: ["nurse-today"],
    queryFn: async () => (await api.get("/appointments/today")).data.data,
  });
  const { data: patients } = useQuery({
    queryKey: ["nurse-patients"],
    queryFn: async () => (await api.get("/patients?limit=1")).data.meta,
  });
  const { data: wards } = useQuery({
    queryKey: ["wards"],
    queryFn: async () => (await api.get("/wards")).data.data,
  });

  const waiting = (today || []).filter((a: any) => ["PENDING", "CONFIRMED"].includes(a.status));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Nurse Station</h1>
        <p className="text-gray-500">Welcome, {user?.firstName}. Triage today&apos;s patients and keep the wards up to date.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Today's appointments" value={today?.length || 0} icon={CalendarDays} color="blue" />
        <StatCard label="Waiting for triage" value={waiting.length} icon={Clock} color="yellow" />
        <StatCard label="Registered patients" value={patients?.total || 0} icon={Users} color="green" />
        <StatCard
          label="Beds occupied"
          value={wards ? `${wards.occupiedBeds}/${wards.totalBeds}` : "—"}
          icon={BedDouble}
          color={wards?.occupancyRate >= 85 ? "red" : "teal"}
          hint={wards ? `${wards.occupancyRate}% occupancy` : undefined}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="card xl:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <HeartPulse className="h-5 w-5 text-rose-500" /> Triage queue
          </h2>
          {!today ? (
            <LoadingState />
          ) : today.length === 0 ? (
            <EmptyState title="No appointments today" />
          ) : (
            <div className="space-y-2">
              {today.map((apt: any) => {
                const done = recorded.has(apt.id);
                const name = `${apt.patient?.user.firstName} ${apt.patient?.user.lastName}`;
                return (
                  <div key={apt.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center gap-4">
                      <p className="w-16 text-center font-bold text-primary-700">{formatTime(apt.scheduledTime)}</p>
                      <div className="h-10 w-px bg-gray-300" />
                      <div>
                        <Link href={`/dashboard/patients/${apt.patientId}`} className="font-medium hover:text-primary-700">
                          {name}
                        </Link>
                        <p className="text-sm text-gray-500">
                          {doctorName(apt.doctor?.user)} · {apt.department?.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={apt.status} />
                      <button
                        onClick={() => setTriage({ ...apt, name })}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                          done ? "bg-green-50 text-green-700 ring-1 ring-green-200" : "bg-white text-primary-700 ring-1 ring-primary-200 hover:bg-primary-50",
                        )}
                      >
                        <HeartPulse className="h-3.5 w-3.5" /> {done ? "Vitals recorded" : "Record vitals"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <BedDouble className="h-5 w-5 text-primary-600" /> Wards
            </h2>
            <Link href="/dashboard/wards" className="flex items-center gap-1 text-sm text-primary-600">
              Manage <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          {!wards ? (
            <LoadingState />
          ) : wards.wards.length === 0 ? (
            <EmptyState icon={BedDouble} title="No wards configured" />
          ) : (
            <div className="space-y-3">
              {wards.wards.map((w: any) => {
                const rate = w.totalBeds ? Math.round((w.occupiedBeds / w.totalBeds) * 100) : 0;
                return (
                  <div key={w.department}>
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-gray-800">{w.department}</span>
                      <span className="tabular-nums text-gray-500">
                        {w.occupiedBeds}/{w.totalBeds}
                      </span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className={cn("h-full rounded-full", rate >= 90 ? "bg-red-500" : rate >= 75 ? "bg-amber-500" : "bg-medical-500")}
                        style={{ width: `${rate}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {triage && (
        <RecordVitalsModal
          open
          onClose={() => setTriage(null)}
          onSaved={() => setRecorded((r) => new Set(r).add(triage.id))}
          patientId={triage.patientId}
          patientName={triage.name}
          appointmentId={triage.id}
        />
      )}
    </div>
  );
}
