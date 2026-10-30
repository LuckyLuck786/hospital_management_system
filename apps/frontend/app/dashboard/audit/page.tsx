"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { roleLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { ChevronLeft, ChevronRight, ShieldCheck } from "lucide-react";

const ACTION_STYLE: Record<string, string> = {
  CREATE: "bg-green-50 text-green-700 ring-green-200",
  UPDATE: "bg-blue-50 text-blue-700 ring-blue-200",
  DELETE: "bg-red-50 text-red-700 ring-red-200",
};

export default function AuditLogPage() {
  const [action, setAction] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["audit", action, page],
    queryFn: async () => (await api.get(`/audit-logs?limit=20&page=${page}${action ? `&action=${action}` : ""}`)).data,
  });

  const rows = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Every create, update and delete made through the API — who, what, when and from where. Passwords, tokens and OTPs are redacted."
      />

      <div className="flex flex-wrap gap-2">
        {["", "CREATE", "UPDATE", "DELETE"].map((a) => (
          <button
            key={a || "all"}
            onClick={() => {
              setAction(a);
              setPage(1);
            }}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              action === a ? "bg-primary-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50",
            )}
          >
            {a ? a.charAt(0) + a.slice(1).toLowerCase() : "All actions"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message="Could not load the audit trail." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No activity recorded yet" description="Changes made by staff will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">When</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Entity</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r: any) => {
                  const verb = String(r.action).split(" ")[0];
 return (
                    <Fragment key={r.id}>
                      <tr className="cursor-pointer hover:bg-gray-50" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                          {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {r.user ? `${r.user.firstName} ${r.user.lastName}` : "System"}
                          </p>
                          <p className="text-xs text-gray-500">{r.user ? roleLabel(r.user.role) : ""}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", ACTION_STYLE[verb] || "bg-gray-100 text-gray-600 ring-gray-200")}>
                            {verb}
                          </span>
                          <span className="ml-2 font-mono text-xs text-gray-500">/{String(r.action).split(" ")[1] || ""}</span>
                        </td>
                        <td className="hidden px-4 py-3 text-gray-600 md:table-cell">
                          {r.entityType}
                          {r.entityId && <span className="ml-1 font-mono text-xs text-gray-400">#{String(r.entityId).slice(0, 8)}</span>}
                        </td>
                        <td className="hidden px-4 py-3 font-mono text-xs text-gray-500 lg:table-cell">{r.ipAddress || "—"}</td>
                      </tr>
                      {expanded === r.id && (
                        <tr className="bg-gray-50">
                          <td colSpan={5} className="px-4 py-3">
                            <p className="mb-1 text-xs font-medium uppercase text-gray-400">Request body (redacted)</p>
                            <pre className="max-h-64 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-gray-100">{JSON.stringify(r.newValues, null, 2)}</pre>
                            <p className="mt-2 truncate text-xs text-gray-400">User agent: {r.userAgent || "—"}</p>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm text-gray-500">
            <span>
              Page {meta.page} of {meta.totalPages} · {meta.total} events
            </span>
            <div className="flex gap-2">
              <button className="btn-secondary px-2 py-1" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button className="btn-secondary px-2 py-1" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
