"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/shared/modal";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate, formatCurrency } from "@/lib/roles";
import { CreditCard, CheckCircle2, FileCheck2, ReceiptText, AlertCircle, IndianRupee } from "lucide-react";

export default function ReceptionistBillingPage() {
  const [filter, setFilter] = useState("");
  const [invoice, setInvoice] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["invoices", filter],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "50" });
      if (filter) params.set("status", filter);
      const res = await api.get(`/invoices?${params}`);
      return res.data.data;
    },
  });

  const finalize = useMutation({
    mutationFn: async (id: string) => {
      await api.patch(`/invoices/${id}/finalize`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });

  const invoices = data || [];
  const revenue = invoices.filter((i: any) => i.status === "PAID").reduce((s: number, i: any) => s + Number(i.totalAmount), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Finalise invoices and record payments." />

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm text-gray-500">Showing</p>
          <p className="text-2xl font-bold text-gray-900">{invoices.length} invoices</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm text-gray-500">Collected (shown)</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(revenue)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <p className="text-sm text-gray-500">Outstanding (shown)</p>
          <p className="text-2xl font-bold text-orange-600">
            {formatCurrency(invoices.filter((i: any) => i.status === "FINALIZED").reduce((s: number, i: any) => s + Number(i.balanceAmount), 0))}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        {["", "DRAFT", "FINALIZED", "PAID"].map((f) => (
          <button
            key={f || "all"}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f ? "bg-primary-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {f || "All"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load invoices." onRetry={() => refetch()} />
      ) : invoices.length === 0 ? (
        <EmptyState icon={ReceiptText} title="No invoices" description="Invoices appear here when appointments are booked." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 font-medium">Invoice</th>
                <th className="px-6 py-3 font-medium">Patient</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Items</th>
                <th className="px-6 py-3 font-medium">Total</th>
                <th className="px-6 py-3 font-medium">Balance</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs text-gray-700">{inv.invoiceNumber}</td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {inv.patient?.user?.firstName} {inv.patient?.user?.lastName}
                  </td>
                  <td className="px-6 py-3 text-gray-600">{formatDate(inv.createdAt)}</td>
                  <td className="px-6 py-3 text-gray-600">{inv.items?.length || 0}</td>
                  <td className="px-6 py-3 font-semibold text-gray-900">{formatCurrency(inv.totalAmount)}</td>
                  <td className="px-6 py-3 text-gray-600">{formatCurrency(inv.balanceAmount)}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-6 py-3">
                    {inv.status === "DRAFT" && (
                      <button
                        onClick={() => finalize.mutate(inv.id)}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" /> Finalize
                      </button>
                    )}
                    {inv.status === "FINALIZED" && (
                      <button
                        onClick={() => setInvoice(inv)}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                      >
                        <IndianRupee className="w-3.5 h-3.5" /> Collect
                      </button>
                    )}
                    {inv.status === "PAID" && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {invoice && (
        <CollectModal
          invoice={invoice}
          onClose={() => setInvoice(null)}
          onDone={() => {
            setInvoice(null);
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }}
        />
      )}
    </div>
  );
}

function CollectModal({ invoice, onClose, onDone }: { invoice: any; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState(String(invoice.balanceAmount));
  const [method, setMethod] = useState("CASH");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const collect = async () => {
    setError("");
    setProcessing(true);
    try {
      await api.post(`/invoices/${invoice.id}/pay`, { amount: parseFloat(amount), method });
      onDone();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Payment failed");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Collect payment — ${invoice.invoiceNumber}`}>
      <div className="space-y-4">
        <div className="bg-green-50 rounded-xl p-4">
          <p className="text-xs text-green-700">Outstanding balance</p>
          <p className="text-2xl font-bold text-green-800">{formatCurrency(invoice.balanceAmount)}</p>
        </div>
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
          <input type="number" className="input-field" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
          <select className="input-field" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="CARD">Card</option>
            <option value="UPI">UPI</option>
            <option value="NET_BANKING">Net Banking</option>
            <option value="INSURANCE">Insurance</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={collect} disabled={processing} className="btn-primary disabled:opacity-50">
            {processing ? "Processing…" : "Record Payment"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
