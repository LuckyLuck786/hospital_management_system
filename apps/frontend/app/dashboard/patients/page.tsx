"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate } from "@/lib/roles";
import { ChevronLeft, ChevronRight, Search, Users, ChevronRight as Go } from "lucide-react";

function age(dob?: string) {
  if (!dob) return null;
  const d = new Date(dob);
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}

export default function PatientsDirectory() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["patients-directory", debounced, page],
    queryFn: async () =>
      (await api.get(`/patients?limit=12&page=${page}${debounced ? `&search=${encodeURIComponent(debounced)}` : ""}`)).data,
  });

  const patients = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader title="Patients" description="Search the registry and open a patient's chart, vitals and history." />

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          className="input-field pl-9"
          placeholder="Search by name, email or phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message="Could not load patients." onRetry={() => refetch()} />
        ) : patients.length === 0 ? (
          <EmptyState icon={Users} title="No patients found" description="Try a different name, email or phone number." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">MRN</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Age / Sex</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Blood</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Phone</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Visits</th>
                  <th className="hidden px-4 py-3 font-medium xl:table-cell">Registered</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {patients.map((p: any) => (
                  <tr key={p.id} className="group hover:bg-primary-50/40">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/patients/${p.id}`} className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-medical-100 text-xs font-semibold text-primary-700">
                          {p.user.firstName[0]}
                          {p.user.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-gray-900 group-hover:text-primary-700">
                            {p.user.firstName} {p.user.lastName}
                          </p>
                          <p className="truncate text-xs text-gray-500">{p.user.email}</p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{p.patientId}</td>
                    <td className="hidden px-4 py-3 text-gray-600 md:table-cell">
                      {age(p.user.dateOfBirth) ?? "—"} {p.user.gender ? `· ${p.user.gender[0]}` : ""}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {p.user.bloodGroup ? (
                        <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                          {p.user.bloodGroup.replace("_POSITIVE", "+").replace("_NEGATIVE", "−")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">{p.user.phone || "—"}</td>
                    <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">{p._count?.appointments ?? 0}</td>
                    <td className="hidden px-4 py-3 text-gray-500 xl:table-cell">{formatDate(p.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/dashboard/patients/${p.id}`} className="inline-flex items-center text-xs font-medium text-primary-600">
                        Open chart <Go className="h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
            <span>
              Page {meta.page} of {meta.totalPages} · {meta.total} patients
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary px-2 py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                className="btn-secondary px-2 py-1"
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
