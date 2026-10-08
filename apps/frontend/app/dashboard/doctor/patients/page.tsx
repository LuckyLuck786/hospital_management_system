"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate } from "@/lib/roles";
import { Search, Users } from "lucide-react";

export default function DoctorPatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["patients", search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (search) params.set("search", search);
      const res = await api.get(`/patients?${params}`);
      return res.data;
    },
  });

  const patients = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader title="Patients" description="Search the hospital patient registry." />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, email or phone…"
          className="input-field pl-10"
        />
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load patients." onRetry={() => refetch()} />
      ) : patients.length === 0 ? (
        <EmptyState icon={Users} title="No patients found" />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {patients.map((p: any) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-medical-100 rounded-full flex items-center justify-center text-medical-700 font-bold">
                    {p.user.firstName?.[0]}
                    {p.user.lastName?.[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-gray-900 truncate">
                      {p.user.firstName} {p.user.lastName}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{p.user.email}</p>
                  </div>
                  <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                    {p.patientId}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                  <div>
                    <p className="text-gray-400">Phone</p>
                    <p className="font-medium truncate">{p.user.phone || "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Blood</p>
                    <p className="font-medium">{p.user.bloodGroup?.replace(/_/g, " ") || "—"}</p>
                  </div>
                  <div>
                    <p className="text-gray-400">Visits</p>
                    <p className="font-medium">{p._count?.appointments || 0}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Page {meta.page} of {meta.totalPages} · {meta.total} patients
              </p>
              <div className="flex gap-2">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="btn-secondary text-xs disabled:opacity-40">
                  Previous
                </button>
                <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="btn-secondary text-xs disabled:opacity-40">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
