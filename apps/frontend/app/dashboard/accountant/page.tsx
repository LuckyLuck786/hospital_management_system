"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, EmptyState } from "@/components/shared/states";
import { formatDate, formatCurrency } from "@/lib/roles";
import { TrendingUp, ReceiptText, Hourglass, CheckCircle2, Download } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const STATUS_COLORS: Record<string, string> = { PAID: "#10b981", FINALIZED: "#6366f1", DRAFT: "#9ca3af", PARTIALLY_PAID: "#f59e0b", OVERDUE: "#ef4444", CANCELLED: "#d1d5db" };

export default function AccountantDashboard() {
  const { user } = useAuthStore();

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["accountant-invoices"],
    queryFn: async () => (await api.get("/invoices?limit=100")).data.data,
  });

  const { data: revenueSeries } = useQuery({
    queryKey: ["accountant-revenue"],
    queryFn: async () => (await api.get("/analytics/revenue")).data.data,
  });

  const byStatus = Object.entries(
    (invoices || []).reduce((acc: Record<string, number>, i: any) => ({ ...acc, [i.status]: (acc[i.status] || 0) + 1 }), {}),
  ).map(([name, value]) => ({ name, value: value as number }));

  // Simple CSV export of the invoices on screen, for reconciliation in a spreadsheet
  const exportCsv = () => {
    const rows = [["Invoice", "Patient", "Date", "Status", "Total", "Paid", "Balance"]].concat(
      (invoices || []).map((i: any) => [
        i.invoiceNumber,
        `${i.patient?.user?.firstName ?? ""} ${i.patient?.user?.lastName ?? ""}`.trim(),
        String(i.createdAt).slice(0, 10),
        i.status,
        i.totalAmount,
        i.paidAmount,
        i.balanceAmount,
      ]),
    );
    const csv = rows.map((r: any[]) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `invoices-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  const paid = (invoices || []).filter((i: any) => i.status === "PAID");
  const outstanding = (invoices || []).filter((i: any) => i.status === "FINALIZED");
  const revenue = paid.reduce((s: number, i: any) => s + Number(i.totalAmount), 0);
  const pending = outstanding.reduce((s: number, i: any) => s + Number(i.balanceAmount), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-gray-500">Welcome, {user?.firstName}. Collections, receivables and revenue trend.</p>
        </div>
        <button onClick={exportCsv} disabled={!invoices?.length} className="btn-secondary inline-flex items-center gap-2 text-sm">
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Revenue Collected" value={formatCurrency(revenue)} icon={TrendingUp} color="green" />
        <StatCard label="Outstanding" value={formatCurrency(pending)} icon={Hourglass} color="orange" />
        <StatCard label="Paid Invoices" value={paid.length} icon={CheckCircle2} color="blue" />
        <StatCard label="Total Invoices" value={invoices?.length || 0} icon={ReceiptText} color="purple" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Collections (30 days)</h2>
            <span className="text-sm font-semibold text-emerald-600">{formatCurrency(revenueSeries?.total || 0)}</span>
          </div>
          <div className="h-64">
            {!revenueSeries ? (
              <LoadingState />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={revenueSeries.series} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="accGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(d: string) => d.slice(5)} minTickGap={28} />
                  <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: any) => [formatCurrency(Number(v)), "Collected"]} labelFormatter={(l: string) => formatDate(l)} />
                  <Area type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} fill="url(#accGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
        <div className="card">
          <h2 className="mb-4 text-lg font-semibold">Invoices by status</h2>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={2}>
                  {byStatus.map((d) => (
                    <Cell key={d.name} fill={STATUS_COLORS[d.name] || "#9ca3af"} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {byStatus.map((d) => (
              <div key={d.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: STATUS_COLORS[d.name] || "#9ca3af" }} />
                  {d.name.replace(/_/g, " ").toLowerCase()}
                </span>
                <span className="tabular-nums text-gray-600">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
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
