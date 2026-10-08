"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Modal } from "@/components/shared/modal";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate, formatCurrency } from "@/lib/roles";
import {
  FlaskConical,
  TestTube,
  CheckCircle2,
  AlertTriangle,
  Microscope,
  Search,
  Stethoscope,
  X,
} from "lucide-react";

const STATUS_STEPS = ["ORDERED", "SAMPLE_COLLECTED", "PROCESSING", "RESULT_UPLOADED", "APPROVED"] as const;

function statusColor(status: string) {
  switch (status) {
    case "ORDERED": return "bg-blue-50 text-blue-700";
    case "SAMPLE_COLLECTED": return "bg-amber-50 text-amber-700";
    case "PROCESSING": return "bg-purple-50 text-purple-700";
    case "RESULT_UPLOADED": return "bg-cyan-50 text-cyan-700";
    case "APPROVED": return "bg-green-50 text-green-700";
    case "REJECTED": return "bg-red-50 text-red-700";
    default: return "bg-gray-50 text-gray-600";
  }
}

export default function LabDashboard() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<string>("ALL");
  const [resultsOrder, setResultsOrder] = useState<any>(null);
  const [resultValues, setResultValues] = useState<Record<string, string>>({});

  const { data: orders, isLoading, isError, refetch } = useQuery({
    queryKey: ["lab-orders", filter],
    queryFn: async () => {
      const res = await api.get(`/lab/orders${filter !== "ALL" ? `?status=${filter}` : ""}`);
      return res.data.data;
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) =>
      (await api.patch(`/lab/orders/${id}/status`, { status })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
    },
  });

  const resultsMutation = useMutation({
    mutationFn: async ({ id, results }: { id: string; results: any[] }) =>
      (await api.post(`/lab/orders/${id}/results`, { results })).data,
    onSuccess: () => {
      setResultsOrder(null);
      setResultValues({});
      queryClient.invalidateQueries({ queryKey: ["lab-orders"] });
    },
  });

  const ordersList = orders || [];
  const countBy = (s: string) => ordersList.filter((o: any) => o.status === s).length;

  const openResults = (order: any) => {
    setResultsOrder(order);
    const initial: Record<string, string> = {};
    order.results?.forEach((r: any) => {
      const test = order.tests.find((t: any) => t.testName === r.testName);
      if (test) initial[test.id] = r.value;
    });
    setResultValues(initial);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FlaskConical className="w-6 h-6 text-primary-600" /> Laboratory
        </h1>
        <p className="text-gray-500">Lab orders, sample collection, and result approval workflow.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Orders" value={ordersList.length} icon={TestTube} color="blue" />
        <StatCard label="Awaiting Sample" value={countBy("ORDERED")} icon={Microscope} color="amber" />
        <StatCard label="Processing" value={countBy("SAMPLE_COLLECTED") + countBy("PROCESSING")} icon={FlaskConical} color="purple" />
        <StatCard label="Ready to Review" value={countBy("RESULT_UPLOADED")} icon={CheckCircle2} color="green" />
      </div>

      <div className="flex flex-wrap gap-2">
        {["ALL", ...STATUS_STEPS, "REJECTED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === s
                ? "bg-primary-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {s === "ALL" ? "All" : s.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load lab orders." onRetry={() => refetch()} />
      ) : ordersList.length === 0 ? (
        <EmptyState title="No lab orders here" description="Orders created by doctors will appear in this queue." />
      ) : (
        <div className="space-y-4">
          {ordersList.map((order: any) => (
            <div key={order.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-semibold text-sm shrink-0">
                    {order.medicalRecord?.patient?.user?.firstName?.[0]}
                    {order.medicalRecord?.patient?.user?.lastName?.[0]}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="font-semibold text-gray-900">
                        {order.medicalRecord?.patient?.user?.firstName} {order.medicalRecord?.patient?.user?.lastName}
                      </p>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${statusColor(order.status)}`}>
                        {order.status.split("_").map((w: string) => w[0] + w.slice(1).toLowerCase()).join(" ")}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{order.orderNumber}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
                      <Stethoscope className="w-3.5 h-3.5" />
                      Dr. {order.medicalRecord?.doctor?.user?.firstName} {order.medicalRecord?.doctor?.user?.lastName}
                      <span className="text-gray-300">•</span>
                      {formatDate(order.createdAt)}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {order.tests.map((t: any) => (
                        <span key={t.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-100 text-xs text-gray-700">
                          {t.testName}
                          {t.price && <span className="text-gray-400">{formatCurrency(t.price)}</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {order.status === "ORDERED" && (
                    <button className="btn-primary text-xs" onClick={() => statusMutation.mutate({ id: order.id, status: "SAMPLE_COLLECTED" })}>
                      <TestTube className="w-3.5 h-3.5" /> Collect Sample
                    </button>
                  )}
                  {order.status === "SAMPLE_COLLECTED" && (
                    <button className="btn-primary text-xs" onClick={() => statusMutation.mutate({ id: order.id, status: "PROCESSING" })}>
                      <Microscope className="w-3.5 h-3.5" /> Start Processing
                    </button>
                  )}
                  {order.status === "PROCESSING" && (
                    <button className="btn-primary text-xs" onClick={() => openResults(order)}>
                      <Search className="w-3.5 h-3.5" /> Enter Results
                    </button>
                  )}
                  {order.status === "RESULT_UPLOADED" && (
                    <>
                      <button
                        className="btn-primary text-xs"
                        onClick={() => statusMutation.mutate({ id: order.id, status: "APPROVED" })}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                      </button>
                      <button
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1"
                        onClick={() => statusMutation.mutate({ id: order.id, status: "REJECTED" })}
                      >
                        <X className="w-3.5 h-3.5" /> Reject
                      </button>
                    </>
                  )}
                  {order.status === "APPROVED" && (
                    <button className="btn-secondary text-xs" onClick={() => openResults(order)}>
                      <Search className="w-3.5 h-3.5" /> View Report
                    </button>
                  )}
                </div>
              </div>

              {order.results?.length > 0 && (
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
                              <span className="inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold bg-green-100 text-green-700">
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!resultsOrder}
        onClose={() => setResultsOrder(null)}
        title={`Enter Results — ${resultsOrder?.medicalRecord?.patient?.user?.firstName ?? ""} ${resultsOrder?.medicalRecord?.patient?.user?.lastName ?? ""}`}
        wide
      >
        {resultsOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {resultsOrder.tests.map((t: any) => (
                <div key={t.id} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm font-semibold text-gray-900">{t.testName}</p>
                  <p className="text-xs text-gray-500 mb-2">
                    Reference: {t.referenceRanges ? JSON.stringify(t.referenceRanges) : "—"} {t.unit || ""}
                  </p>
                  <input
                    className="input-field text-sm"
                    placeholder={t.unit ? `Value in ${t.unit}` : "Result value"}
                    value={resultValues[t.id] || ""}
                    onChange={(e) => setResultValues((v) => ({ ...v, [t.id]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setResultsOrder(null)} className="btn-secondary">Cancel</button>
              <button
                onClick={() =>
                  resultsMutation.mutate({
                    id: resultsOrder.id,
                    results: resultsOrder.tests.map((t: any) => ({ testId: t.id, value: resultValues[t.id] || "" })),
                  })
                }
                disabled={resultsMutation.isPending || resultsOrder.tests.some((t: any) => !resultValues[t.id])}
                className="btn-primary disabled:opacity-50"
              >
                {resultsMutation.isPending ? "Saving…" : "Save Results"}
              </button>
            </div>
            <p className="text-xs text-gray-400">Out-of-range values are flagged automatically against the reference ranges.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
