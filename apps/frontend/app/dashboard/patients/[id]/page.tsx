"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { doctorName, formatDate, formatTime } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { FamilyHistoryPanel, RecordsPanel, VaccinationsPanel, VitalsPanel } from "@/components/modules/patient-panels";
import { PreAuthModal } from "@/components/modules/pre-auth-modal";
import { AlertTriangle, ArrowLeft, BedDouble, CalendarDays, Droplet, FileText, HeartPulse, Mail, Phone, ShieldCheck, Syringe } from "lucide-react";

type Tab = "vitals" | "records" | "vaccinations" | "visits";

function age(dob?: string) {
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000));
}

export default function PatientChartPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const role = user?.role || "";
  const clinical = role === "DOCTOR" || role === "NURSE";
  const canSeeRecords = clinical; // PRD: EMR is visible to doctors, nurses and the patient
  const [tab, setTab] = useState<Tab>(clinical ? "vitals" : "visits");
  const [preAuthOpen, setPreAuthOpen] = useState(false);
  const canPreAuth = ["DOCTOR", "RECEPTIONIST", "ACCOUNTANT", "HOSPITAL_ADMIN"].includes(role);

  const { data: p, isLoading, isError, refetch } = useQuery({
    queryKey: ["patient", id],
    queryFn: async () => (await api.get(`/patients/${id}`)).data.data,
  });

  if (isLoading) return <LoadingState label="Opening chart…" />;
  if (isError || !p) return <ErrorState message="You may not have access to this patient, or the chart does not exist." onRetry={() => refetch()} />;

  const u = p.user;
  const tabs: Array<{ key: Tab; label: string; icon: any; show: boolean }> = [
    { key: "vitals", label: "Vitals", icon: HeartPulse, show: role !== "RECEPTIONIST" },
    { key: "records", label: "Medical records", icon: FileText, show: canSeeRecords },
    { key: "vaccinations", label: "Vaccinations", icon: Syringe, show: role !== "RECEPTIONIST" },
    { key: "visits", label: "Visits", icon: CalendarDays, show: true },
  ];

  return (
    <div className="space-y-6">
      <Link href="/dashboard/patients" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="h-4 w-4" /> All patients
      </Link>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="h-20 bg-gradient-to-r from-primary-600 via-primary-500 to-medical-500" />
        <div className="px-5 pb-5">
          <div className="-mt-10 flex flex-wrap items-start gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-gradient-to-br from-primary-100 to-medical-100 text-2xl font-bold text-primary-700 shadow">
              {u.firstName[0]}
              {u.lastName[0]}
            </div>
            <div className="min-w-0 flex-1 pt-12">
              <h1 className="text-2xl font-bold text-gray-900">
                {u.firstName} {u.lastName}
              </h1>
              <p className="text-sm text-gray-500">
                <span className="font-mono">{p.patientId}</span>
                {age(u.dateOfBirth) != null && ` · ${age(u.dateOfBirth)} yrs`}
                {u.gender && ` · ${u.gender.charAt(0)}${u.gender.slice(1).toLowerCase()}`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 pt-12">
              {p.bed && (
                <Link href="/dashboard/wards" className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100">
                  <BedDouble className="h-3.5 w-3.5" /> Admitted · {p.bed.room.roomNumber} {p.bed.label}
                </Link>
              )}
              {u.bloodGroup && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-700">
                  <Droplet className="h-3.5 w-3.5" /> {u.bloodGroup.replace("_POSITIVE", "+").replace("_NEGATIVE", "−")}
                </span>
              )}
              {canPreAuth && (
                <button onClick={() => setPreAuthOpen(true)} className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100">
                  <ShieldCheck className="h-3.5 w-3.5" /> Request pre-authorisation
                </button>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                {p._count?.appointments ?? 0} visits · {p._count?.medicalRecords ?? 0} records
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-4 text-sm md:grid-cols-3">
            <div className="space-y-1.5">
              <p className="flex items-center gap-2 text-gray-600">
                <Mail className="h-4 w-4 text-gray-400" /> {u.email}
              </p>
              <p className="flex items-center gap-2 text-gray-600">
                <Phone className="h-4 w-4 text-gray-400" /> {u.phone || "No phone on file"}
              </p>
              {p.emergencyContactName && (
                <p className="text-gray-500">
                  Emergency: {p.emergencyContactName} {p.emergencyContactPhone && `(${p.emergencyContactPhone})`}
                </p>
              )}
            </div>
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Allergies</h4>
              {p.allergies ? (
                <p className="inline-flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {p.allergies}
                </p>
              ) : (
                <p className="text-gray-400">No known allergies</p>
              )}
              {p.insuranceProvider && (
                <p className="mt-2 flex items-center gap-1.5 text-gray-600">
                  <ShieldCheck className="h-4 w-4 text-medical-500" /> {p.insuranceProvider} · {p.insurancePolicyNumber}
                </p>
              )}
            </div>
            <FamilyHistoryPanel patient={p} canEdit={clinical} />
          </div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                tab === t.key ? "border-primary-600 text-primary-700" : "border-transparent text-gray-500 hover:text-gray-800",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
      </div>

      {canPreAuth && <PreAuthModal open={preAuthOpen} onClose={() => setPreAuthOpen(false)} patient={p} />}

      {tab === "vitals" && <VitalsPanel patientId={p.id} canRecord={clinical} patientName={`${u.firstName} ${u.lastName}`} />}
      {tab === "records" && canSeeRecords && <RecordsPanel patientId={p.id} canUpload={clinical} />}
      {tab === "vaccinations" && <VaccinationsPanel patientId={p.id} canRecord={clinical} />}
      {tab === "visits" &&
        (p.appointments?.length ? (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {p.appointments.map((a: any) => (
              <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="font-medium text-gray-900">{a.reason || "Consultation"}</p>
                  <p className="text-xs text-gray-500">
                    {formatDate(a.scheduledDate)} · {formatTime(a.scheduledTime)} · {doctorName(a.doctor?.user)} · {a.department?.name}
                  </p>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={CalendarDays} title="No visits yet" />
        ))}
    </div>
  );
}
