"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate } from "@/lib/roles";
import { Search, Users } from "lucide-react";

export default function ReceptionistPatientsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reception-patients", search, page],
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
      <PageHeader title="Patients" description="Hospital patient registry." />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search patients…"
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
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50">
                  <th className="px-6 py-3 font-medium">Patient</th>
                  <th className="px-6 py-3 font-medium">Patient ID</th>
                  <th className="px-6 py-3 font-medium">Phone</th>
                  <th className="px-6 py-3 font-medium">Blood Group</th>
                  <th className="px-6 py-3 font-medium">Visits</th>
                  <th className="px-6 py-3 font-medium">Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map((p: any) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-medical-100 rounded-full flex items-center justify-center text-medical-700 text-xs font-bold">
                          {p.user.firstName?.[0]}
                          {p.user.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {p.user.firstName} {p.user.lastName}
                          </p>
                          <p className="text-xs text-gray-500">{p.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-3 font-mono text-xs text-gray-600">{p.patientId}</td>
                    <td className="px-6 py-3 text-gray-600">{p.user.phone || "—"}</td>
                    <td className="px-6 py-3 text-gray-600">{p.user.bloodGroup?.replace(/_/g, " ") || "—"}</td>
                    <td className="px-6 py-3 text-gray-600">{p._count?.appointments || 0}</td>
                    <td className="px-6 py-3 text-gray-500">{formatDate(p.user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
