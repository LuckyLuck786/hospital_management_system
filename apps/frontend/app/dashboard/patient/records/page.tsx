"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate } from "@/lib/roles";
import { FileText, HeartPulse, Stethoscope, Activity, Droplets } from "lucide-react";

export default function PatientRecordsPage() {
  const { user } = useAuthStore();

  const { data: records, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-records"],
    queryFn: async () => {
      // Resolve own patient profile, then fetch records
      const me = await api.get("/auth/me");
      const patientId = me.data.data.patient?.id;
      if (!patientId) return [];
      const res = await api.get(`/medical-records/patient/${patientId}`);
      return res.data.data;
    },
  });

  const vitals = (r: any): Array<{ label: string; icon: any; value: any; unit: string }> => [
    { label: "BP", icon: HeartPulse, value: r.vitalsBloodPressureSystolic ? `${r.vitalsBloodPressureSystolic}/${r.vitalsBloodPressureDiastolic}` : null, unit: "mmHg" },
    { label: "Pulse", icon: Activity, value: r.vitalsPulse, unit: "bpm" },
    { label: "Temp", icon: Droplets, value: r.vitalsTemperature, unit: "°F" },
    { label: "SpO₂", icon: Activity, value: r.vitalsSpO2, unit: "%" },
    { label: "BMI", icon: Activity, value: r.vitalsBmi, unit: "" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="My Medical Records" description={`Your health history at MedCore. Welcome, ${user?.firstName}.`} />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load your records." onRetry={() => refetch()} />
      ) : records?.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No medical records yet"
          description="Once a doctor completes a consultation, your records will appear here."
        />
      ) : (
        <div className="space-y-4">
          {records.map((r: any) => (
            <div key={r.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4 text-primary-600" />
                  <span className="text-sm font-semibold text-gray-800">
                    Dr. {r.doctor?.user?.firstName} {r.doctor?.user?.lastName}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span>{formatDate(r.createdAt)}</span>
                  <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{r.recordNumber}</span>
                </div>
              </div>

              <div className="px-5 py-4">
                <div className="grid grid-cols-5 gap-3">
                  {vitals(r).map((v) => (
                    <div key={v.label} className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-[11px] text-gray-400">{v.label}</p>
                      <p className="font-semibold text-gray-800 mt-0.5">
                        {v.value ?? "—"} <span className="text-[10px] text-gray-400 font-normal">{v.unit}</span>
                      </p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <p className="text-xs text-gray-400">Chief Complaint</p>
                    <p className="text-sm text-gray-800 mt-0.5">{r.chiefComplaint || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Diagnosis</p>
                    <p className="text-sm text-gray-800 mt-0.5">
                      {r.diagnosis || "—"}
                      {r.icd10Code && <span className="text-xs text-gray-400 ml-1">({r.icd10Code})</span>}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-400">Treatment Plan</p>
                    <p className="text-sm text-gray-800 mt-0.5">{r.treatmentPlan || "—"}</p>
                  </div>
                  {r.prescriptions?.length > 0 && (
                    <div className="col-span-2">
                      <p className="text-xs text-gray-400">Prescriptions</p>
                      <div className="flex flex-wrap gap-2 mt-1.5">
                        {r.prescriptions.map((p: any) =>
                          p.items?.map((item: any) => (
                            <span key={item.id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-medical-50 text-medical-700 text-xs font-medium">
                              {item.medicine?.name} · {item.dosage} · {item.frequency} · {item.duration} {item.durationUnit.toLowerCase()}
                            </span>
                          )),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
