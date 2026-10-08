"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, EmptyState } from "@/components/shared/states";
import { formatDate, formatCurrency } from "@/lib/roles";
import { TrendingUp, ReceiptText, Hourglass, CheckCircle2 } from "lucide-react";

export default function AccountantDashboard() {
  const { user } = useAuthStore();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["accountant-invoices"],
    queryFn: async () => (await api.get("/invoices?limit=100")).data.data,
  });

  const paid = (invoices || []).filter((i: any) => i.status === "PAID");
  const outstanding = (invoices || []).filter((i: any) => i.status === "FINALIZED");
  const revenue = paid.reduce((s: number, i: any) => s + Number(i.totalAmount), 0);
  const pending = outstanding.reduce((s: number, i: any) => s + Number(i.balanceAmount), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
        <p className="text-gray-500">Welcome, {user?.firstName}. Revenue overview.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Revenue Collected" value={formatCurrency(revenue)} icon={TrendingUp} color="green" />
        <StatCard label="Outstanding" value={formatCurrency(pending)} icon={Hourglass} color="orange" />
        <StatCard label="Paid Invoices" value={paid.length} icon={CheckCircle2} color="blue" />
        <StatCard label="Total Invoices" value={invoices?.length || 0} icon={ReceiptText} color="purple" />
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recent Invoices</h2>
        {isLoading ? (
          <LoadingState />
        ) : invoices?.length === 0 ? (
          <EmptyState title="No invoices yet" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-3 font-medium">Invoice</th>
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Paid</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(invoices || []).slice(0, 10).map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {inv.patient?.user?.firstName} {inv.patient?.user?.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(inv.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatCurrency(inv.paidAmount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
