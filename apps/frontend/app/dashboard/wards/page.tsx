"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Modal } from "@/components/shared/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { BedDouble, Building2, Loader2, Percent, Plus, Search, Sparkles, UserRound, Wrench } from "lucide-react";

const BED_STYLE: Record<string, string> = {
  AVAILABLE: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400",
  OCCUPIED: "border-rose-200 bg-rose-50 text-rose-800 hover:border-rose-400",
  CLEANING: "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-400",
  MAINTENANCE: "border-gray-200 bg-gray-100 text-gray-500 hover:border-gray-400",
};

function rateColor(rate: number) {
  if (rate >= 90) return "bg-red-500";
  if (rate >= 75) return "bg-amber-500";
  if (rate >= 40) return "bg-medical-500";
  return "bg-primary-400";
}

function since(date?: string) {
  if (!date) return "";
  const h = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 3600000));
  return h < 48 ? `${h} h` : `${Math.round(h / 24)} d`;
}

export default function WardsPage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const role = user?.role || "";
  const canManage = ["SUPER_ADMIN", "HOSPITAL_ADMIN", "NURSE", "RECEPTIONIST"].includes(role);
  const canAddRoom = ["SUPER_ADMIN", "HOSPITAL_ADMIN"].includes(role);
  const [bed, setBed] = useState<any>(null);
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
        description="Every bed in the hospital. Click a free bed to admit a patient, an occupied bed to discharge."
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
        <StatCard label="Occupied" value={data.occupiedBeds} icon={Building2} color="orange" hint={`${data.totalBeds - data.occupiedBeds} not occupied`} />
        <StatCard label="Occupancy rate" value={`${data.occupancyRate}%`} icon={Percent} color={data.occupancyRate >= 85 ? "red" : "teal"} />
      </div>

      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries({ AVAILABLE: "Available", OCCUPIED: "Occupied", CLEANING: "Cleaning", MAINTENANCE: "Maintenance" }).map(([k, l]) => (
          <span key={k} className={cn("rounded-full border px-2.5 py-1 font-medium", BED_STYLE[k])}>
            {l}
          </span>
        ))}
      </div>

      {data.wards.length === 0 ? (
        <EmptyState icon={BedDouble} title="No rooms configured" description={canAddRoom ? "Add your first ward or room to start tracking beds." : "An administrator has not configured rooms yet."} />
      ) : (
        <div className="space-y-5">
          {data.wards.map((w: any) => {
            const rate = w.totalBeds ? Math.round((w.occupiedBeds / w.totalBeds) * 100) : 0;
            return (
              <section key={w.department} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-gray-900">{w.department}</h3>
                    <p className="text-sm text-gray-500">
                      {w.occupiedBeds} / {w.totalBeds} beds occupied · {w.rooms.length} rooms
                    </p>
                  </div>
                  <div className="flex w-full items-center gap-3 sm:w-64">
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className={cn("h-full rounded-full", rateColor(rate))} style={{ width: `${rate}%` }} />
                    </div>
                    <span className="w-10 text-right text-sm font-semibold tabular-nums">{rate}%</span>
                  </div>
                </div>
                <div className="mt-4 space-y-4">
                  {w.rooms.map((r: any) => (
                    <div key={r.id}>
                      <p className="mb-2 text-sm">
                        <span className="font-medium text-gray-900">{r.roomNumber}</span> <span className="text-gray-500">· {r.type}</span>
                      </p>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {r.beds.map((b: any) => (
                          <button
                            key={b.id}
                            disabled={!canManage}
                            onClick={() => setBed({ ...b, roomNumber: r.roomNumber })}
                            className={cn("rounded-lg border p-2.5 text-left transition-colors disabled:cursor-default", BED_STYLE[b.status])}
                          >
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="flex items-center gap-1">
                                <BedDouble className="h-3.5 w-3.5" /> {b.label}
                              </span>
                              {b.status === "OCCUPIED" && <span className="font-normal opacity-70">{since(b.admittedAt)}</span>}
                            </div>
                            <p className="mt-1 truncate text-sm">
                              {b.patient
                                ? `${b.patient.user.firstName} ${b.patient.user.lastName}`
                                : b.status === "AVAILABLE"
                                  ? "Free"
                                  : b.status === "CLEANING"
                                    ? "Being cleaned"
                                    : b.status === "MAINTENANCE"
                                      ? "Out of service"
                                      : "Occupied"}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {bed && <BedModal bed={bed} role={role} onClose={() => setBed(null)} />}

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

function BedModal({ bed, role, onClose }: { bed: any; role: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [patient, setPatient] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const canSetStatus = ["SUPER_ADMIN", "HOSPITAL_ADMIN", "NURSE"].includes(role);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["bed-patient-search", debounced],
    queryFn: async () => (await api.get(`/patients?limit=6&search=${encodeURIComponent(debounced)}`)).data.data,
    enabled: bed.status === "AVAILABLE" && debounced.length >= 2,
  });

  const done = () => {
    qc.invalidateQueries({ queryKey: ["wards"] });
    qc.invalidateQueries({ queryKey: ["admin-analytics"] });
    onClose();
  };
  const onErr = (e: any) => setError(e.response?.data?.error?.message || "Something went wrong");
  const admit = useMutation({ mutationFn: async () => (await api.post(`/wards/beds/${bed.id}/admit`, { patientId: patient.id, notes })).data, onSuccess: done, onError: onErr });
  const discharge = useMutation({ mutationFn: async () => (await api.post(`/wards/beds/${bed.id}/discharge`)).data, onSuccess: done, onError: onErr });
  const setStatus = useMutation({ mutationFn: async (status: string) => (await api.patch(`/wards/beds/${bed.id}/status`, { status })).data, onSuccess: done, onError: onErr });

  return (
    <Modal open onClose={onClose} title={`${bed.roomNumber} · ${bed.label}`}>
      <div className="space-y-4">
        {bed.status === "OCCUPIED" && (
          <>
            {bed.patient ? (
              <div className="flex items-start gap-3 rounded-xl bg-rose-50 p-4">
                <UserRound className="mt-0.5 h-5 w-5 text-rose-600" />
                <div className="text-sm">
                  <Link href={`/dashboard/patients/${bed.patient.id}`} className="font-semibold text-gray-900 hover:text-primary-700">
                    {bed.patient.user.firstName} {bed.patient.user.lastName}
                  </Link>
                  <p className="text-gray-500">
                    {bed.patient.patientId} · admitted {bed.admittedAt ? new Date(bed.admittedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : ""}
                  </p>
                  {bed.admissionNotes && <p className="mt-1 text-gray-700">{bed.admissionNotes}</p>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Occupied (no patient linked).</p>
            )}
            <button className="btn-primary inline-flex w-full items-center justify-center gap-2" disabled={discharge.isPending} onClick={() => discharge.mutate()}>
              {discharge.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Discharge — bed goes to cleaning
            </button>
          </>
        )}

        {bed.status === "AVAILABLE" && (
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input className="input-field pl-9" placeholder="Search patient by name, email or phone…" value={search} onChange={(e) => setSearch(e.target.value)} autoFocus />
            </div>
            {isFetching && <p className="text-xs text-gray-400">Searching…</p>}
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {(results || []).map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setPatient(p)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm",
                    patient?.id === p.id ? "bg-primary-50 ring-1 ring-primary-300" : "hover:bg-gray-50",
                  )}
                >
                  <span>
                    {p.user.firstName} {p.user.lastName}
                    <span className="ml-2 font-mono text-xs text-gray-400">{p.patientId}</span>
                  </span>
                  <span className="text-xs text-gray-400">{p.user.phone}</span>
                </button>
              ))}
            </div>
            {patient && (
              <textarea className="input-field" rows={2} placeholder="Reason for admission (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
            )}
            <button className="btn-primary inline-flex w-full items-center justify-center gap-2" disabled={!patient || admit.isPending} onClick={() => admit.mutate()}>
              {admit.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {patient ? `Admit ${patient.user.firstName} ${patient.user.lastName}` : "Select a patient to admit"}
            </button>
            {canSetStatus && (
              <button className="btn-secondary inline-flex w-full items-center justify-center gap-2 text-sm" onClick={() => setStatus.mutate("MAINTENANCE")}>
                <Wrench className="h-4 w-4" /> Take out of service
              </button>
            )}
          </>
        )}

        {(bed.status === "CLEANING" || bed.status === "MAINTENANCE") &&
          (canSetStatus ? (
            <button className="btn-primary inline-flex w-full items-center justify-center gap-2" disabled={setStatus.isPending} onClick={() => setStatus.mutate("AVAILABLE")}>
              <Sparkles className="h-4 w-4" /> Mark ready for the next patient
            </button>
          ) : (
            <p className="text-sm text-gray-500">This bed is {bed.status.toLowerCase()}. A nurse or admin can mark it ready.</p>
          ))}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Modal>
  );
}
