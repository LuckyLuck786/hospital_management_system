"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { StatCard } from "@/components/shared/stat-card";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatCurrency, formatDate } from "@/lib/roles";
import { Pill, PackageX, AlertTriangle, Layers, PackageCheck, FlaskConical } from "lucide-react";

export default function PharmacyDashboard() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [dispenseError, setDispenseError] = useState<string | null>(null);

  const { data: medicines, isLoading, isError, refetch } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => (await api.get("/medicines?limit=100")).data.data,
  });

  const { data: pending } = useQuery({
    queryKey: ["pending-prescriptions"],
    queryFn: async () => (await api.get("/pharmacy/prescriptions/pending")).data.data,
  });

  const dispenseMutation = useMutation({
    mutationFn: async (id: string) => (await api.post(`/pharmacy/dispense/${id}`)).data,
    onSuccess: () => {
      setDispenseError(null);
      queryClient.invalidateQueries({ queryKey: ["pending-prescriptions"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
    onError: (err: any) => {
      setDispenseError(err.response?.data?.error?.message || "Could not dispense prescription");
    },
  });

  const lowStock = (medicines || []).filter((m: any) => m.isLowStock);
  const totalStock = (medicines || []).reduce((s: number, m: any) => s + (m.inStock || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pharmacy</h1>
        <p className="text-gray-500">Welcome, {user?.firstName}. Inventory overview.</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Medicines" value={medicines?.length || 0} icon={Pill} color="blue" />
        <StatCard label="Units in Stock" value={totalStock} icon={Layers} color="green" />
        <StatCard label="Low Stock Alerts" value={lowStock.length} icon={AlertTriangle} color="red" />
        <StatCard label="Expired / Quarantined" value="1" icon={PackageX} color="orange" hint="Demo batch" />
      </div>

      {dispenseError && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" /> {dispenseError}
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
          <PackageCheck className="w-5 h-5 text-primary-600" /> Prescriptions to Dispense
        </h2>
        <p className="text-xs text-gray-400 mb-4">Stock is consumed FIFO (oldest batch first). Charges are added to the visit invoice.</p>
        {!pending || pending.length === 0 ? (
          <EmptyState title="No pending prescriptions" description="Prescriptions from consultations will queue up here." />
        ) : (
          <div className="space-y-3">
            {pending.slice(0, 12).map((p: any) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="font-semibold text-gray-900">
                    {p.medicalRecord?.patient?.user?.firstName} {p.medicalRecord?.patient?.user?.lastName}
                    <span className="text-xs text-gray-400 font-mono ml-2">{p.prescriptionNumber}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Dr. {p.doctor?.user?.firstName} {p.doctor?.user?.lastName} • {formatDate(p.createdAt)}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {p.items.map((i: any) => (
                      <span key={i.id} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs ${i.inStock <= (i.medicine?.reorderLevel || 0) ? "bg-red-50 text-red-700" : "bg-white text-gray-700 border border-gray-200"}`}>
                        {i.medicine?.name} × {i.duration}d ({i.frequency})
                        <span className="text-gray-400">stock {i.inStock}</span>
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  className="btn-primary text-xs"
                  onClick={() => dispenseMutation.mutate(p.id)}
                  disabled={dispenseMutation.isPending && dispenseMutation.variables === p.id}
                >
                  {dispenseMutation.isPending && dispenseMutation.variables === p.id ? "Dispensing…" : "Dispense"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load inventory." onRetry={() => refetch()} />
      ) : (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary-600" /> Medicine Inventory
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                  <th className="px-4 py-3 font-medium">Medicine</th>
                  <th className="px-4 py-3 font-medium">Form</th>
                  <th className="px-4 py-3 font-medium">Unit Price</th>
                  <th className="px-4 py-3 font-medium">In Stock</th>
                  <th className="px-4 py-3 font-medium">Reorder Level</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {medicines?.map((m: any) => (
                  <tr key={m.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-500">{m.genericName}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{m.form}</td>
                    <td className="px-4 py-3 text-gray-600">{formatCurrency(m.unitPrice)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{m.inStock}</td>
                    <td className="px-4 py-3 text-gray-500">{m.reorderLevel}</td>
                    <td className="px-4 py-3">
                      {m.isLowStock ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-red-50 text-red-700">
                          <AlertTriangle className="w-3 h-3" /> Low stock
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-green-50 text-green-700">
                          In stock
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
