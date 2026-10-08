"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { Building2, MapPin, Users, Stethoscope, BadgeCheck } from "lucide-react";

export default function AdminHospitalsPage() {
  const { data: hospitals, isLoading, isError, refetch } = useQuery({
    queryKey: ["hospitals"],
    queryFn: async () => (await api.get("/hospitals")).data,
  });

  const list = hospitals?.data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hospitals"
        description="All hospitals registered on the MedCore platform."
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load hospitals." onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState icon={Building2} title="No hospitals registered" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {list.map((h: any) => (
            <div key={h.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-primary-600 rounded-xl flex items-center justify-center text-white font-bold">
                    {h.name[0]}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{h.name}</p>
                    <p className="text-xs text-gray-500">{h.email}</p>
                  </div>
                </div>
                {h.isVerified ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700">
                    <BadgeCheck className="w-3 h-3" /> Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-yellow-50 text-yellow-700">
                    Pending
                  </span>
                )}
              </div>

              {h.address && (
                <p className="text-sm text-gray-500 mt-3 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  {h.address.street}, {h.address.city}, {h.address.state} {h.address.zipCode}
                </p>
              )}

              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-100 text-sm">
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Users className="w-4 h-4 text-gray-400" /> {h._count?.users || 0} users
                </div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Stethoscope className="w-4 h-4 text-gray-400" /> {h._count?.doctors || 0} doctors
                </div>
                <div className="flex items-center gap-1.5 text-gray-600">
                  <Building2 className="w-4 h-4 text-gray-400" /> {h._count?.departments || 0} departments
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
