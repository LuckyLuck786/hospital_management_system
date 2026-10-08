"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { Stethoscope, GraduationCap, IndianRupee, Briefcase, CheckCircle2, XCircle } from "lucide-react";
import { formatCurrency } from "@/lib/roles";

export default function AdminDoctorsPage() {
  const { data: doctors, isLoading, isError, refetch } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => (await api.get("/doctors")).data.data,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctors"
        description="View all doctors, their specialisations and consultation fees."
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load doctors." onRetry={() => refetch()} />
      ) : doctors?.length === 0 ? (
        <EmptyState icon={Stethoscope} title="No doctors yet" description="Add doctors from the Users page." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {doctors.map((doc: any) => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold text-lg shrink-0">
                  {doc.user.firstName?.[0]}
                  {doc.user.lastName?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {doc.user.firstName} {doc.user.lastName}
                  </p>
                  <p className="text-sm text-primary-600 font-medium">{doc.specialization}</p>
                  <p className="text-xs text-gray-500 truncate">{doc.department?.name || "General"}</p>
                </div>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    doc.isAvailable ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}
                >
                  {doc.isAvailable ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {doc.isAvailable ? "Available" : "Unavailable"}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100 text-sm">
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <IndianRupee className="w-3 h-3" /> Fee
                  </p>
                  <p className="font-medium text-gray-900 mt-0.5">
                    {doc.consultationFee ? formatCurrency(doc.consultationFee) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> Experience
                  </p>
                  <p className="font-medium text-gray-900 mt-0.5">{doc.experienceYears || 0} yrs</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <GraduationCap className="w-3 h-3" /> Degree
                  </p>
                  <p className="font-medium text-gray-900 mt-0.5 truncate" title={doc.qualification || ""}>
                    {doc.qualification || "—"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
