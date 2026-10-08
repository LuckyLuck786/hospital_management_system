"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/shared/modal";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate, formatCurrency } from "@/lib/roles";
import { CreditCard, AlertCircle, CheckCircle2, IndianRupee, Smartphone, Landmark } from "lucide-react";

export default function PatientBillsPage() {
  const [payInvoice, setPayInvoice] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data: invoices, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-invoices"],
    queryFn: async () => (await api.get("/invoices?limit=50")).data.data,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My Bills" description="Track and pay your hospital invoices." />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load invoices." onRetry={() => refetch()} />
      ) : invoices?.length === 0 ? (
        <EmptyState icon={CreditCard} title="No invoices yet" description="Invoices are generated when you book appointments." />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 font-medium">Invoice</th>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Items</th>
                <th className="px-6 py-3 font-medium">Total</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3 font-mono text-xs text-gray-700">{inv.invoiceNumber}</td>
                  <td className="px-6 py-3 text-gray-600">{formatDate(inv.createdAt)}</td>
                  <td className="px-6 py-3 text-gray-600">{inv.items?.length || 0}</td>
                  <td className="px-6 py-3 font-semibold text-gray-900">{formatCurrency(inv.totalAmount)}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-6 py-3">
                    {inv.status === "FINALIZED" && (
                      <button onClick={() => setPayInvoice(inv)} className="btn-primary text-xs px-3 py-1.5">
                        Pay Now
                      </button>
                    )}
                    {inv.status === "PAID" && (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                      </span>
                    )}
                    {inv.status === "DRAFT" && <span className="text-xs text-gray-400">Pending finalization</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payInvoice && (
        <PayModal
          invoice={payInvoice}
          onClose={() => setPayInvoice(null)}
          onPaid={() => {
            setPayInvoice(null);
            queryClient.invalidateQueries({ queryKey: ["my-invoices"] });
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
          }}
        />
      )}
    </div>
  );
}

function PayModal({ invoice, onClose, onPaid }: { invoice: any; onClose: () => void; onPaid: () => void }) {
  const [method, setMethod] = useState("UPI");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);

  const { data: payConfig } = useQuery({
    queryKey: ["payments-config"],
    queryFn: async () => (await api.get("/payments/config")).data.data,
  });
  const onlineEnabled = payConfig?.configured;

  const pay = useMutation({
    mutationFn: async () => {
      const res = await api.post(`/invoices/${invoice.id}/pay`, {
        amount: invoice.balanceAmount,
        method,
      });
      return res.data;
    },
    onSuccess: onPaid,
    onError: (err: any) => setError(err.response?.data?.error?.message || "Payment failed"),
  });

  const payOnline = useMutation({
    mutationFn: async () => (await api.post(`/payments/orders/${invoice.id}`)).data.data,
    onSuccess: (data) => {
      // Dynamically load the Razorpay checkout and let the webhook finalize the invoice
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => {
        const rzp = new (window as any).Razorpay({
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          order_id: data.orderId,
          name: "MedCore HMS",
          description: `Invoice ${data.invoiceNumber}`,
          prefill: { contact: "", email: "" },
          handler: async (response: any) => {
            // Standard Checkout: verify order_id|payment_id signature on the server.
            // The webhook remains the authoritative reconciliation from the gateway.
            try {
              await api.post("/payments/verify-payment", {
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              });
              onPaid();
            } catch (err: any) {
              setError(
                err.response?.data?.error?.message ||
                  "Payment could not be verified. It will be reconciled via webhook — please check your bills shortly.",
              );
              setProcessing(false);
            }
          },
          modal: { ondismiss: () => setProcessing(false) },
        });
        // Show a friendly error if the payment attempt itself failed
        rzp.on("payment.failed", (response: any) => {
          setError(
            response?.error?.description || "Payment failed. Please try again or pay at the counter.",
          );
          setProcessing(false);
        });
        rzp.open();
      };
      script.onerror = () => {
        setError("Could not load the payment gateway. Please try again.");
        setProcessing(false);
      };
      document.body.appendChild(script);
    },
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || "Could not start online payment");
      setProcessing(false);
    },
  });

  const methods = [
    { key: "UPI", label: "UPI", icon: Smartphone },
    { key: "CARD", label: "Card", icon: CreditCard },
    { key: "NET_BANKING", label: "Net Banking", icon: Landmark },
    { key: "CASH", label: "Cash", icon: IndianRupee },
  ];

  return (
    <Modal open onClose={onClose} title={`Pay ${invoice.invoiceNumber}`}>
      <div className="space-y-5">
        <div className="bg-primary-50 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-primary-700">Outstanding balance</p>
            <p className="text-2xl font-bold text-primary-900">{formatCurrency(invoice.balanceAmount)}</p>
          </div>
          <p className="text-xs text-primary-600">Invoice total: {formatCurrency(invoice.totalAmount)}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {onlineEnabled && (
          <button
            onClick={() => {
              setProcessing(true);
              setError("");
              payOnline.mutate();
            }}
            disabled={processing}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4" />
            Pay Online with Razorpay (UPI / Cards / Net Banking)
          </button>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-white px-3 text-xs text-gray-400">or pay at the counter</span>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Record a payment (staff/counter)</p>
          <div className="grid grid-cols-2 gap-2">
            {methods.map((m) => {
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => setMethod(m.key)}
                  className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                    method === m.key ? "border-primary-600 bg-primary-50 text-primary-700" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <Icon className="w-4 h-4" /> {m.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={() => {
              setProcessing(true);
              pay.mutate();
            }}
            disabled={processing}
            className="btn-primary disabled:opacity-50"
          >
            {processing ? "Processing…" : `Record ${formatCurrency(invoice.balanceAmount)}`}
          </button>
        </div>
      </div>
    </Modal>
  );
}
