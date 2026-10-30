"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { formatCurrency, formatDate } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Modal } from "@/components/shared/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { FileClaimModal } from "@/components/modules/file-claim-modal";
import { BadgeCheck, CircleDollarSign, FileClock, Hourglass, Loader2, Plus, ShieldCheck } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: "bg-blue-50 text-blue-700 ring-blue-200",
  UNDER_REVIEW: "bg-violet-50 text-violet-700 ring-violet-200",
  APPROVED: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  PARTIALLY_APPROVED: "bg-amber-50 text-amber-800 ring-amber-200",
  REJECTED: "bg-red-50 text-red-700 ring-red-200",
  SETTLED: "bg-gray-100 text-gray-700 ring-gray-200",
};
const FILTERS = ["", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "PARTIALLY_APPROVED", "REJECTED", "SETTLED"];

export default function InsuranceClaimsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canAdjudicate = ["HOSPITAL_ADMIN", "ACCOUNTANT"].includes(user?.role || "");
  const canFile = ["HOSPITAL_ADMIN", "ACCOUNTANT", "RECEPTIONIST"].includes(user?.role || "");
  const [filter, setFilter] = useState("");
  const [fileOpen, setFileOpen] = useState(false);
  const [decision, setDecision] = useState<{ claim: any; kind: "partial" | "reject" } | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["claims", filter],
    queryFn: async () => (await api.get(`/insurance-claims${filter ? `?status=${filter}` : ""}`)).data,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["claims"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };
  const onErr = (e: any) => setError(e.response?.data?.error?.message || "Action failed");
  const move = useMutation({
    mutationFn: async ({ id, ...body }: any) => (await api.patch(`/insurance-claims/${id}/status`, body)).data,
    onSuccess: () => {
      refresh();
      setDecision(null);
      setAmount("");
      setNote("");
      setError("");
    },
    onError: onErr,
  });
  const settle = useMutation({
    mutationFn: async (id: string) => (await api.post(`/insurance-claims/${id}/settle`, {})).data,
    onSuccess: () => {
      refresh();
      setError("");
    },
    onError: onErr,
  });

  const claims = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Insurance & TPA Claims"
        description="File claims against unpaid invoices, track insurer review, and post settlements straight to the bill."
        actions={
          canFile && (
            <button className="btn-primary inline-flex items-center gap-2" onClick={() => setFileOpen(true)}>
              <Plus className="h-4 w-4" /> New claim
            </button>
          )
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Claims" value={meta?.total ?? "—"} icon={ShieldCheck} color="blue" />
        <StatCard label="Open" value={meta?.open ?? "—"} icon={Hourglass} color="yellow" />
        <StatCard label="Amount claimed" value={formatCurrency(meta?.claimed || 0)} icon={FileClock} color="purple" />
        <StatCard label="Settled by insurers" value={formatCurrency(meta?.settled || 0)} icon={CircleDollarSign} color="green" />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f || "all"}
            onClick={() => setFilter(f)}
            className={cn("rounded-full px-3 py-1.5 text-xs font-medium", filter === f ? "bg-primary-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50")}
          >
            {f ? f.replace(/_/g, " ").toLowerCase() : "All"}
          </button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message="Could not load claims." onRetry={() => refetch()} />
        ) : claims.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="No claims here" description={canFile ? "File a claim from an unpaid invoice to get started." : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Claim</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Insurer / TPA</th>
                  <th className="px-4 py-3 font-medium">Claimed</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Approved</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {canAdjudicate && <th className="px-4 py-3 font-medium">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.map((c: any) => (
                  <tr key={c.id} className="align-top hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-gray-800">{c.claimNumber}</p>
                      <p className="text-xs text-gray-500">
                        {c.invoice?.invoiceNumber} · {formatDate(c.submittedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {c.patient?.user?.firstName} {c.patient?.user?.lastName}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      <p className="text-gray-800">{c.insurer}</p>
                      <p className="text-xs text-gray-500">
                        {c.tpaName ? `${c.tpaName} · ` : ""}
                        {c.policyNumber}
                      </p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{formatCurrency(c.claimedAmount)}</td>
                    <td className="hidden px-4 py-3 tabular-nums lg:table-cell">{c.approvedAmount != null ? formatCurrency(c.approvedAmount) : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", STATUS_STYLE[c.status])}>{c.status.replace(/_/g, " ")}</span>
                      {c.decisionNote && <p className="mt-1 max-w-[14rem] text-xs text-gray-500">{c.decisionNote}</p>}
                    </td>
                    {canAdjudicate && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1.5">
                          {c.status === "SUBMITTED" && (
                            <button className="rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700 hover:bg-violet-100" onClick={() => move.mutate({ id: c.id, status: "UNDER_REVIEW" })}>
                              Start review
                            </button>
                          )}
                          {c.status === "UNDER_REVIEW" && (
                            <>
                              <button className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100" onClick={() => move.mutate({ id: c.id, status: "APPROVED" })}>
                                Approve
                              </button>
                              <button className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100" onClick={() => setDecision({ claim: c, kind: "partial" })}>
                                Partial
                              </button>
                            </>
                          )}
                          {(c.status === "SUBMITTED" || c.status === "UNDER_REVIEW") && (
                            <button className="rounded-lg bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100" onClick={() => setDecision({ claim: c, kind: "reject" })}>
                              Reject
                            </button>
                          )}
                          {(c.status === "APPROVED" || c.status === "PARTIALLY_APPROVED") && (
                            <button
                              className="inline-flex items-center gap-1 rounded-lg bg-primary-50 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-100"
                              disabled={settle.isPending}
                              onClick={() => settle.mutate(c.id)}
                            >
                              <BadgeCheck className="h-3.5 w-3.5" /> Record settlement
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FileClaimModal open={fileOpen} onClose={() => setFileOpen(false)} />

      <Modal open={!!decision} onClose={() => setDecision(null)} title={decision?.kind === "partial" ? "Partial approval" : "Reject claim"}>
        {decision && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              move.mutate(
                decision.kind === "partial"
                  ? { id: decision.claim.id, status: "PARTIALLY_APPROVED", approvedAmount: Number(amount), decisionNote: note || undefined }
                  : { id: decision.claim.id, status: "REJECTED", decisionNote: note },
              );
            }}
          >
            <p className="text-sm text-gray-600">
              {decision.claim.claimNumber} · claimed <strong>{formatCurrency(decision.claim.claimedAmount)}</strong>
            </p>
            {decision.kind === "partial" && (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-gray-600">Amount the insurer approved (₹)</span>
                <input type="number" min="1" step="0.01" max={Number(decision.claim.claimedAmount) - 0.01} required className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">{decision.kind === "reject" ? "Reason (required)" : "Note (e.g. deductions)"}</span>
              <textarea className="input-field" rows={2} required={decision.kind === "reject"} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setDecision(null)}>
                Cancel
              </button>
              <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={move.isPending}>
                {move.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Confirm
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
