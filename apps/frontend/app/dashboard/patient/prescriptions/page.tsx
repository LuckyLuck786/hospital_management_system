"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate } from "@/lib/roles";
import { downloadPdf } from "@/lib/download-pdf";
import { Pill, Printer, Loader2 } from "lucide-react";
import { useState } from "react";

export default function PatientPrescriptionsPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const { data: records, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-prescriptions"],
    queryFn: async () => {
      const me = await api.get("/auth/me");
      const patientId = me.data.data.patient?.id;
      if (!patientId) return [];
      const res = await api.get(`/medical-records/patient/${patientId}`);
      const recordsWithRx = (res.data.data || []).filter((r: any) => r.prescriptions?.length > 0);
      return recordsWithRx;
    },
  });

  const prescriptions = (records || []).flatMap((r: any) =>
    r.prescriptions.map((p: any) => ({ ...p, recordDate: r.createdAt, doctor: r.doctor })),
  );

  return (
    <div className="space-y-6">
      <PageHeader title="My Prescriptions" description="All prescriptions issued during your visits." />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load prescriptions." onRetry={() => refetch()} />
      ) : prescriptions.length === 0 ? (
        <EmptyState icon={Pill} title="No prescriptions yet" description="Prescriptions from your doctor will appear here." />
      ) : (
        <div className="space-y-4">
          {prescriptions.map((p: any) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-2">
                  <Pill className="w-4 h-4 text-medical-600" />
                  <span className="text-sm font-semibold text-gray-800">
                    Prescription {p.prescriptionNumber}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">
                    Dr. {p.doctor?.user?.firstName} {p.doctor?.user?.lastName} · {formatDate(p.recordDate)}
                  </span>
                  <button
                    onClick={async () => {
                      setDownloading(p.id);
                      try {
                        await downloadPdf(`/prescriptions/${p.id}/pdf`, `prescription-${p.prescriptionNumber}.pdf`);
                      } finally {
                        setDownloading(null);
                      }
                    }}
                    disabled={downloading === p.id}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 disabled:opacity-50"
                  >
                    {downloading === p.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Printer className="w-3.5 h-3.5" />
                    )}{" "}
                    PDF
                  </button>
                </div>
              </div>
              <div className="px-5 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {p.items.map((item: any) => (
                    <div key={item.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{item.medicine?.name}</p>
                        <p className="text-xs text-gray-500">{item.medicine?.genericName} · {item.medicine?.form}</p>
                      </div>
                      <div className="text-right text-xs text-gray-600">
                        <p>
                          <span className="font-semibold">{item.dosage}</span> · {item.frequency}
                        </p>
                        <p>
                          {item.duration} {item.durationUnit.toLowerCase()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                {p.instructions && (
                  <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
                    <span className="font-medium">Instructions:</span> {p.instructions}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
