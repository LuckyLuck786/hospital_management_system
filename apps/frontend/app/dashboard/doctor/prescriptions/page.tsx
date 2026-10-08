"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate } from "@/lib/roles";
import { FileText, Pill } from "lucide-react";

export default function DoctorPrescriptionsPage() {
  const { data: appointments, isLoading, isError, refetch } = useQuery({
    queryKey: ["doctor-records"],
    queryFn: async () => {
      const res = await api.get("/appointments?status=COMPLETED&limit=20");
      return res.data.data;
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Records & Prescriptions" description="Completed consultations and prescriptions you have issued." />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load records." onRetry={() => refetch()} />
      ) : appointments?.length === 0 ? (
        <EmptyState icon={FileText} title="No completed consultations yet" description="Completed appointments will appear here." />
      ) : (
        <div className="space-y-3">
          {appointments.map((apt: any) => (
            <div key={apt.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-sm font-semibold">
                    {apt.patient?.user.firstName?.[0]}
                    {apt.patient?.user.lastName?.[0]}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {apt.patient?.user.firstName} {apt.patient?.user.lastName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(apt.scheduledDate)} · {apt.reason || "Consultation"}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-gray-400">{apt.medicalRecord ? "EMR recorded" : "No EMR"}</span>
              </div>
              {apt.medicalRecord && (
                <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-gray-400">Diagnosis</p>
                    <p className="font-medium text-gray-800">{apt.medicalRecord.diagnosis || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Treatment</p>
                    <p className="text-gray-600 truncate" title={apt.medicalRecord.treatmentPlan || ""}>
                      {apt.medicalRecord.treatmentPlan || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <Pill className="w-3 h-3" /> Prescriptions
                    </p>
                    <p className="font-medium text-gray-800">
                      {apt.medicalRecord.prescriptions?.length || 0}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
