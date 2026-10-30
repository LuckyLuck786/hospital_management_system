"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/shared/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { AlertTriangle, Boxes, Loader2, PackagePlus, Plus, Search } from "lucide-react";

const FORMS = ["TABLET", "CAPSULE", "SYRUP", "INJECTION", "TOPICAL", "DROPS", "INHALER"];

export default function InventoryPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "expiring">("all");
  const [medOpen, setMedOpen] = useState(false);
  const [batchFor, setBatchFor] = useState<any>(null);
  const [med, setMed] = useState({ name: "", genericName: "", form: "TABLET", category: "", unitPrice: "", reorderLevel: "50" });
  const [batch, setBatch] = useState({ batchNumber: "", quantity: "", expiryDate: "", manufacturingDate: "", unitCost: "", supplier: "" });
  const [error, setError] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => (await api.get("/medicines?limit=200")).data.data as any[],
  });

  const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();
  const rows = useMemo(() => {
    const q = search.toLowerCase();
    return (data || [])
      .map((m) => {
        const live = (m.batches || []).filter((b: any) => !b.isExpired && !b.isQuarantined);
        const nextExpiry = live.map((b: any) => b.expiryDate).sort()[0];
        return { ...m, nextExpiry, expiringSoon: nextExpiry && nextExpiry <= in30 };
      })
      .filter((m) => !q || m.name.toLowerCase().includes(q) || (m.genericName || "").toLowerCase().includes(q))
      .filter((m) => (filter === "low" ? m.isLowStock : filter === "expiring" ? m.expiringSoon : true));
  }, [data, search, filter, in30]);

  const onErr = (e: any) => setError(e.response?.data?.error?.message || "Something went wrong");
  const addMed = useMutation({
    mutationFn: async () => (await api.post("/medicines", { ...med, unitPrice: Number(med.unitPrice), reorderLevel: Number(med.reorderLevel) })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setMedOpen(false);
      setMed({ name: "", genericName: "", form: "TABLET", category: "", unitPrice: "", reorderLevel: "50" });
      setError("");
    },
    onError: onErr,
  });
  const addBatch = useMutation({
    mutationFn: async () =>
      (await api.post(`/medicines/${batchFor.id}/batches`, { ...batch, quantity: Number(batch.quantity), unitCost: Number(batch.unitCost) })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setBatchFor(null);
      setBatch({ batchNumber: "", quantity: "", expiryDate: "", manufacturingDate: "", unitCost: "", supplier: "" });
      setError("");
    },
    onError: onErr,
  });

  const low = (data || []).filter((m) => m.isLowStock).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Medicines, batches and stock levels. Dispensing always consumes the earliest-expiring batch first."
        actions={
          <button className="btn-primary inline-flex items-center gap-2" onClick={() => setMedOpen(true)}>
            <Plus className="h-4 w-4" /> New medicine
          </button>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input-field pl-9" placeholder="Search medicines…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {([
          ["all", "All"],
          ["low", `Low stock (${low})`],
          ["expiring", "Expiring ≤30 days"],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn("rounded-full px-3 py-1.5 text-sm font-medium", filter === k ? "bg-primary-600 text-white" : "bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-gray-50")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message="Could not load inventory." onRetry={() => refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState icon={Boxes} title="No medicines match" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Medicine</th>
                  <th className="px-4 py-3 font-medium">Form</th>
                  <th className="px-4 py-3 font-medium">In stock</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Reorder at</th>
                  <th className="hidden px-4 py-3 font-medium md:table-cell">Next expiry</th>
                  <th className="hidden px-4 py-3 font-medium lg:table-cell">Price</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((m) => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{m.name}</p>
                      <p className="text-xs text-gray-500">
                        {m.genericName}
                        {m.category ? ` · ${m.category}` : ""}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{m.form}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", m.isLowStock ? "text-red-600" : "text-gray-900")}>
                        {m.isLowStock && <AlertTriangle className="h-3.5 w-3.5" />}
                        {m.inStock}
                      </span>
                    </td>
                    <td className="hidden px-4 py-3 tabular-nums text-gray-600 md:table-cell">{m.reorderLevel}</td>
                    <td className={cn("hidden px-4 py-3 md:table-cell", m.expiringSoon ? "font-medium text-amber-600" : "text-gray-600")}>
                      {m.nextExpiry ? formatDate(m.nextExpiry) : "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-gray-600 lg:table-cell">{formatCurrency(m.unitPrice)}</td>
                    <td className="px-4 py-3 text-right">
                      <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50" onClick={() => setBatchFor(m)}>
                        <PackagePlus className="h-3.5 w-3.5" /> Receive stock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={medOpen} onClose={() => setMedOpen(false)} title="New medicine">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            addMed.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Brand name & strength</span>
              <input className="input-field" required value={med.name} onChange={(e) => setMed({ ...med, name: e.target.value })} placeholder="Azithromycin 500mg" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Generic name</span>
              <input className="input-field" value={med.genericName} onChange={(e) => setMed({ ...med, genericName: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Form</span>
              <select className="input-field" value={med.form} onChange={(e) => setMed({ ...med, form: e.target.value })}>
                {FORMS.map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Category</span>
              <input className="input-field" value={med.category} onChange={(e) => setMed({ ...med, category: e.target.value })} placeholder="Antibiotic" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Unit price (₹)</span>
              <input type="number" min="0" step="0.01" required className="input-field" value={med.unitPrice} onChange={(e) => setMed({ ...med, unitPrice: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Reorder level</span>
              <input type="number" min="0" className="input-field" value={med.reorderLevel} onChange={(e) => setMed({ ...med, reorderLevel: e.target.value })} />
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setMedOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={addMed.isPending}>
              {addMed.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add medicine
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!batchFor} onClose={() => setBatchFor(null)} title={`Receive stock — ${batchFor?.name ?? ""}`}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            addBatch.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Batch number</span>
              <input className="input-field" required value={batch.batchNumber} onChange={(e) => setBatch({ ...batch, batchNumber: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Quantity (units)</span>
              <input type="number" min="1" required className="input-field" value={batch.quantity} onChange={(e) => setBatch({ ...batch, quantity: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Manufactured</span>
              <input type="date" className="input-field" value={batch.manufacturingDate} onChange={(e) => setBatch({ ...batch, manufacturingDate: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Expiry</span>
              <input type="date" required className="input-field" min={new Date().toISOString().slice(0, 10)} value={batch.expiryDate} onChange={(e) => setBatch({ ...batch, expiryDate: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Unit cost (₹)</span>
              <input type="number" min="0" step="0.01" className="input-field" value={batch.unitCost} onChange={(e) => setBatch({ ...batch, unitCost: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Supplier</span>
              <input className="input-field" value={batch.supplier} onChange={(e) => setBatch({ ...batch, supplier: e.target.value })} />
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setBatchFor(null)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={addBatch.isPending}>
              {addBatch.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Receive
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
