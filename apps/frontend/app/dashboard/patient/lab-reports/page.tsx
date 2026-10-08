"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate } from "@/lib/roles";
import { downloadPdf } from "@/lib/download-pdf";
import { FlaskConical, AlertTriangle, FileDown, Loader2 } from "lucide-react";

export default function PatientLabReports() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ["patient-lab-orders"],
    queryFn: async () => (await api.get("/lab/orders")).data.data,
  });

  const list = (orders || []).filter(
    (o: any) => o.status === "APPROVED" || o.status === "RESULT_UPLOADED" || o.status === "REJECTED",
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
          <FlaskConical className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lab Reports</h1>
          <p className="text-gray-500 text-sm">Your diagnostic results, reviewed and approved by the laboratory.</p>
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load your lab reports." onRetry={() => refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="No lab reports yet" description="When your doctor orders tests, results will appear here after approval." />
      ) : (
        <div className="space-y-4">
          {list.map((order: any) => {
            const hasAbnormal = order.results?.some((r: any) => r.isAbnormal);
            const isOpen = expanded === order.id;
            return (
              <div key={order.id} className="card p-5">
                <button
                  className="w-full flex flex-wrap items-center justify-between gap-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                >
                  <div>
                    <p className="font-semibold text-gray-900 flex items-center gap-2">
                      {order.orderNumber}
                      {hasAbnormal && order.status === "APPROVED" && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-50 text-red-700">
                          <AlertTriangle className="w-3 h-3" /> Needs attention
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Ordered {formatDate(order.createdAt)} • Dr. {order.medicalRecord?.doctor?.user?.firstName}{" "}
                      {order.medicalRecord?.doctor?.user?.lastName}
                    </p>
                    <p className="text-sm text-gray-700 mt-2">
                      {order.tests.map((t: any) => t.testName).join(" • ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {order.status === "APPROVED" && (
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          setDownloading(order.id);
                          try {
                            await downloadPdf(`/lab/orders/${order.id}/pdf`, `lab-report-${order.orderNumber}.pdf`);
                          } finally {
                            setDownloading(null);
                          }
                        }}
                        disabled={downloading === order.id}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {downloading === order.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <FileDown className="w-3.5 h-3.5" />
                        )}
                        Download PDF
                      </button>
                    )}
                    <StatusBadge status={order.status} />
                  </div>
                </button>

                {isOpen && order.results?.length > 0 && (
                  <div className="mt-4 overflow-x-auto rounded-lg border border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wider text-gray-500 bg-gray-50 border-b border-gray-100">
                          <th className="px-4 py-2.5 font-medium">Test</th>
                          <th className="px-4 py-2.5 font-medium">Result</th>
                          <th className="px-4 py-2.5 font-medium">Reference Range</th>
                          <th className="px-4 py-2.5 font-medium">Flag</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {order.results.map((r: any, i: number) => (
                          <tr key={i} className={r.isAbnormal ? "bg-red-50/40" : ""}>
                            <td className="px-4 py-2.5 font-medium text-gray-900">{r.testName}</td>
                            <td className={`px-4 py-2.5 font-semibold ${r.isAbnormal ? "text-red-600" : "text-gray-800"}`}>
                              {r.value} {r.unit}
                            </td>
                            <td className="px-4 py-2.5 text-gray-500">{r.referenceRange} {r.unit}</td>
                            <td className="px-4 py-2.5">
                              {r.isAbnormal ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-700">
                                  <AlertTriangle className="w-3 h-3" /> Abnormal
                                </span>
                              ) : (
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">Normal</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {isOpen && (!order.results || order.results.length === 0) && (
                  <p className="mt-4 text-sm text-gray-400">Results are being prepared by the laboratory.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
