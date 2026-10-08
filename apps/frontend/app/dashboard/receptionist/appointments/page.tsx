"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/shared/modal";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate, formatTime } from "@/lib/roles";
import { CalendarDays, Plus, CheckCircle2, XCircle, AlertCircle, UserPlus } from "lucide-react";

export default function ReceptionistAppointmentsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["reception-appointments"],
    queryFn: async () => {
      const res = await api.get("/appointments?limit=100");
      return res.data.data;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/appointments/${id}/status`, { status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reception-appointments"] }),
  });

  const appointments = data || [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        description="Book, confirm, and manage the daily schedule."
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Book Appointment
          </button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load appointments." onRetry={() => refetch()} />
      ) : appointments.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No appointments yet" />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 font-medium">Time</th>
                <th className="px-6 py-3 font-medium">Patient</th>
                <th className="px-6 py-3 font-medium">Doctor</th>
                <th className="px-6 py-3 font-medium">Reason</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {appointments.map((apt: any) => (
                <tr key={apt.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <p className="font-medium text-gray-900">{formatTime(apt.scheduledTime)}</p>
                    <p className="text-xs text-gray-500">{formatDate(apt.scheduledDate)}</p>
                  </td>
                  <td className="px-6 py-3 font-medium text-gray-900">
                    {apt.patient?.user.firstName} {apt.patient?.user.lastName}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    Dr. {apt.doctor?.user.lastName}
                    {apt.department?.name ? <span className="text-xs text-gray-400 block">{apt.department.name}</span> : null}
                  </td>
                  <td className="px-6 py-3 text-gray-600 max-w-[220px] truncate">{apt.reason || "—"}</td>
                  <td className="px-6 py-3">
                    <StatusBadge status={apt.status} />
                  </td>
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-1.5">
                      {apt.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => updateStatus.mutate({ id: apt.id, status: "CONFIRMED" })}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg hover:bg-green-100"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                          </button>
                          <button
                            onClick={() => updateStatus.mutate({ id: apt.id, status: "CANCELLED" })}
                            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                          >
                            <XCircle className="w-3.5 h-3.5" /> Cancel
                          </button>
                        </>
                      )}
                      {apt.status === "CONFIRMED" && (
                        <button
                          onClick={() => updateStatus.mutate({ id: apt.id, status: "IN_PROGRESS" })}
                          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Check-in
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <BookModal open={createOpen} onClose={() => setCreateOpen(false)} onDone={() => queryClient.invalidateQueries({ queryKey: ["reception-appointments"] })} />
    </div>
  );
}

function BookModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ patientId: "", doctorId: "", date: "", time: "", reason: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);

  const { data: doctors } = useQuery({
    queryKey: ["doctors"],
    queryFn: async () => (await api.get("/doctors")).data.data,
  });

  const searchPatients = async (q: string) => {
    setPatientSearch(q);
    if (q.length < 1) return;
    const res = await api.get(`/patients?search=${encodeURIComponent(q)}&limit=8`);
    setPatients(res.data.data);
  };

  const book = async () => {
    setError("");
    setSaving(true);
    try {
      await api.post("/appointments", {
        patientId: form.patientId,
        doctorId: form.doctorId,
        scheduledDate: form.date,
        scheduledTime: form.time,
        reason: form.reason,
      });
      onDone();
      onClose();
      setForm({ patientId: "", doctorId: "", date: "", time: "", reason: "" });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Booking failed");
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().split("T")[0];

  return (
    <Modal open={open} onClose={onClose} title="Book Appointment" wide>
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Patient</label>
          <div className="relative">
            <input
              className="input-field"
              placeholder="Search patient by name…"
              value={patientSearch}
              onChange={(e) => searchPatients(e.target.value)}
            />
            {patientSearch && patients.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {patients.map((p: any) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setForm((f) => ({ ...f, patientId: p.id }));
                      setPatientSearch(`${p.user.firstName} ${p.user.lastName} (${p.patientId})`);
                      setPatients([]);
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between"
                  >
                    <span className="text-sm font-medium">
                      {p.user.firstName} {p.user.lastName}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">{p.patientId}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={() => setRegisterOpen(true)}
            className="text-xs text-primary-600 hover:text-primary-700 mt-2 flex items-center gap-1"
          >
            <UserPlus className="w-3.5 h-3.5" /> Register a new patient
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Doctor</label>
          <select className="input-field" value={form.doctorId} onChange={(e) => setForm((f) => ({ ...f, doctorId: e.target.value }))}>
            <option value="">Select doctor</option>
            {doctors?.map((d: any) => (
              <option key={d.id} value={d.id}>
                Dr. {d.user.firstName} {d.user.lastName} — {d.specialization}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <input type="date" min={today} className="input-field" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input type="time" className="input-field" value={form.time} onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
          <input className="input-field" placeholder="Reason for visit" value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={book}
            disabled={saving || !form.patientId || !form.doctorId || !form.date || !form.time}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? "Booking…" : "Book Appointment"}
          </button>
        </div>
      </div>

      <RegisterPatientModal open={registerOpen} onClose={() => setRegisterOpen(false)} onRegistered={(p: any) => {
        setForm((f) => ({ ...f, patientId: p.id }));
        setPatientSearch(`${p.user?.firstName} ${p.user?.lastName}`);
        setRegisterOpen(false);
      }} />
    </Modal>
  );
}

function RegisterPatientModal({ open, onClose, onRegistered }: { open: boolean; onClose: () => void; onRegistered: (p: any) => void }) {
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "Patient@123" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    setSaving(true);
    try {
      const res = await api.post("/users", { ...form, role: "PATIENT" });
      onRegistered(res.data.data);
      setForm({ firstName: "", lastName: "", email: "", phone: "", password: "Patient@123" });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Registration failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Register New Patient">
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input className="input-field" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input className="input-field" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" className="input-field" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input className="input-field" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={submit} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? "Registering…" : "Register Patient"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
