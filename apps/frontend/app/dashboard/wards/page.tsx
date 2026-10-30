"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Modal } from "@/components/shared/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { BedDouble, Building2, Minus, Plus, Percent, Loader2 } from "lucide-react";

function rateColor(rate: number) {
  if (rate >= 90) return "bg-red-500";
  if (rate >= 75) return "bg-amber-500";
  if (rate >= 40) return "bg-medical-500";
  return "bg-primary-400";
}

export default function WardsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const canAdjust = ["SUPER_ADMIN", "HOSPITAL_ADMIN", "NURSE"].includes(user?.role || "");
  const canAddRoom = ["SUPER_ADMIN", "HOSPITAL_ADMIN"].includes(user?.role || "");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ roomNumber: "", type: "General Ward", capacity: "4", departmentId: "" });
  const [error, setError] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["wards"],
    queryFn: async () => (await api.get("/wards")).data.data,
  });
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get("/departments")).data.data,
    enabled: canAddRoom,
  });

  const occupancy = useMutation({
    mutationFn: async ({ id, occupiedBeds }: { id: string; occupiedBeds: number }) =>
      (await api.patch(`/wards/rooms/${id}/occupancy`, { occupiedBeds })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wards"] }),
  });
  const addRoom = useMutation({
    mutationFn: async () => (await api.post("/wards/rooms", { ...form, capacity: Number(form.capacity) })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wards"] });
      setAddOpen(false);
      setForm({ roomNumber: "", type: "General Ward", capacity: "4", departmentId: "" });
      setError("");
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Could not add room"),
  });

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Could not load wards." onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wards & Beds"
        description="Live bed occupancy by department. Nurses update beds as patients are admitted or discharged."
        actions={
          canAddRoom && (
            <button className="btn-primary inline-flex items-center gap-2" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add room
            </button>
          )
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total beds" value={data.totalBeds} icon={BedDouble} color="blue" />
        <StatCard label="Occupied" value={data.occupiedBeds} icon={Building2} color="orange" hint={`${data.totalBeds - data.occupiedBeds} available`} />
        <StatCard label="Occupancy rate" value={`${data.occupancyRate}%`} icon={Percent} color={data.occupancyRate >= 85 ? "red" : "teal"} />
      </div>

      {data.wards.length === 0 ? (
        <EmptyState icon={BedDouble} title="No rooms configured" description={canAddRoom ? "Add your first ward or room to start tracking beds." : "An administrator has not configured rooms yet."} />
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {data.wards.map((w: any) => {
            const rate = w.totalBeds ? Math.round((w.occupiedBeds / w.totalBeds) * 100) : 0;
            return (
              <div key={w.department} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{w.department}</h3>
                    <p className="text-sm text-gray-500">
                      {w.occupiedBeds} / {w.totalBeds} beds occupied · {w.rooms.length} rooms
                    </p>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold text-white", rateColor(rate))}>{rate}%</span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className={cn("h-full rounded-full transition-all", rateColor(rate))} style={{ width: `${rate}%` }} />
                </div>
                <div className="mt-4 space-y-2">
                  {w.rooms.map((r: any) => (
                    <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-gray-50 px-3 py-2">
                      <div className="w-28">
                        <p className="text-sm font-medium text-gray-900">{r.roomNumber}</p>
                        <p className="text-xs text-gray-500">{r.type}</p>
                      </div>
                      <div className="flex flex-1 flex-wrap gap-1">
                        {Array.from({ length: r.capacity }).map((_, i) => (
                          <BedDouble
                            key={i}
                            className={cn("h-5 w-5", i < r.occupiedBeds ? "text-rose-500" : "text-gray-300")}
                            aria-label={i < r.occupiedBeds ? "Occupied bed" : "Free bed"}
                          />
                        ))}
                      </div>
                      {canAdjust && (
                        <div className="flex items-center gap-1">
                          <button
                            className="rounded-md border border-gray-200 bg-white p-1 text-gray-500 hover:text-gray-900 disabled:opacity-40"
                            disabled={r.occupiedBeds <= 0 || occupancy.isPending}
                            onClick={() => occupancy.mutate({ id: r.id, occupiedBeds: r.occupiedBeds - 1 })}
                            aria-label="Discharge one bed"
                          >
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <span className="w-10 text-center text-sm tabular-nums">
                            {r.occupiedBeds}/{r.capacity}
                          </span>
                          <button
                            className="rounded-md border border-gray-200 bg-white p-1 text-gray-500 hover:text-gray-900 disabled:opacity-40"
                            disabled={r.occupiedBeds >= r.capacity || occupancy.isPending}
                            onClick={() => occupancy.mutate({ id: r.id, occupiedBeds: r.occupiedBeds + 1 })}
                            aria-label="Admit to one bed"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add room">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            addRoom.mutate();
          }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Room number</span>
              <input className="input-field" required value={form.roomNumber} onChange={(e) => setForm({ ...form, roomNumber: e.target.value })} placeholder="W-204" />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Beds</span>
              <input type="number" min="1" max="40" className="input-field" required value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </label>
          </div>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Type</span>
            <select className="input-field" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {["General Ward", "Semi-private", "Private", "ICU", "HDU", "Paediatric Ward", "Day Care"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Department</span>
            <select className="input-field" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              <option value="">General (no department)</option>
              {(departments || []).map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={addRoom.isPending}>
              {addRoom.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Add room
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
