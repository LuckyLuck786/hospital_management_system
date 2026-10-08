"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/shared/modal";
import { StatusBadge } from "@/components/shared/status-badge";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { formatDate, formatTime } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  CalendarDays,
  FileText,
  Plus,
  Stethoscope,
  Trash2,
  Search,
  AlertCircle,
} from "lucide-react";

type Tab = "all" | "upcoming" | "today" | "completed";

export default function DoctorAppointmentsPage() {
  const [tab, setTab] = useState<Tab>("upcoming");
  const [consult, setConsult] = useState<any>(null);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["doctor-appointments", tab],
    queryFn: async () => {
      const params = new URLSearchParams({ limit: "100" });
      if (tab === "completed") params.set("status", "COMPLETED");
      const res = await api.get(`/appointments?${params}`);
      const all = res.data.data;
      if (tab === "today") {
        const today = new Date().toISOString().split("T")[0];
        return all.filter((a: any) => String(a.scheduledDate).startsWith(today));
      }
      if (tab === "upcoming") {
        const today = new Date().toISOString().split("T")[0];
        return all.filter(
          (a: any) => String(a.scheduledDate) >= today && ["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(a.status),
        );
      }
      return all;
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await api.patch(`/appointments/${id}/status`, { status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] }),
  });

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: "upcoming", label: "Upcoming" },
    { key: "today", label: "Today" },
    { key: "all", label: "All" },
    { key: "completed", label: "Completed" },
  ];

  const appointments = data || [];

  return (
    <div className="space-y-6">
      <PageHeader title="Appointments" description="Your patient schedule and consultations." />

      <div className="flex items-center gap-2 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-primary-600 text-primary-700"
                : "border-transparent text-gray-500 hover:text-gray-800",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load appointments." onRetry={() => refetch()} />
      ) : appointments.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No appointments" description="New bookings will appear here." />
      ) : (
        <div className="space-y-3">
          {appointments.map((apt: any) => (
            <div key={apt.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="text-center w-16 shrink-0">
                    <p className="font-bold text-primary-700">{formatTime(apt.scheduledTime)}</p>
                    <p className="text-[11px] text-gray-500">{formatDate(apt.scheduledDate)}</p>
                  </div>
                  <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-semibold shrink-0">
                    {apt.patient?.user.firstName?.[0]}
                    {apt.patient?.user.lastName?.[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {apt.patient?.user.firstName} {apt.patient?.user.lastName}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {apt.reason || "General consultation"}
                      {apt.department?.name ? ` • ${apt.department.name}` : ""}
                      {apt.isEmergency && (
                        <span className="ml-2 text-red-600 font-medium text-xs">EMERGENCY</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={apt.status} />
                  {["PENDING", "CONFIRMED", "IN_PROGRESS"].includes(apt.status) && (
                    <button
                      onClick={() => setConsult(apt)}
                      className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1"
                    >
                      <FileText className="w-3.5 h-3.5" /> Consultation
                    </button>
                  )}
                  {apt.status === "PENDING" && (
                    <button
                      onClick={() => updateStatus.mutate({ id: apt.id, status: "CONFIRMED" })}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Confirm
                    </button>
                  )}
                  {apt.status === "CONFIRMED" && (
                    <button
                      onClick={() => updateStatus.mutate({ id: apt.id, status: "IN_PROGRESS" })}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Start
                    </button>
                  )}
                  {apt.status === "IN_PROGRESS" && (
                    <button
                      onClick={() => updateStatus.mutate({ id: apt.id, status: "COMPLETED" })}
                      className="btn-secondary text-xs px-3 py-1.5"
                    >
                      Complete
                    </button>
                  )}
                  {["PENDING", "CONFIRMED"].includes(apt.status) && (
                    <button
                      onClick={() => updateStatus.mutate({ id: apt.id, status: "CANCELLED" })}
                      className="text-xs px-2 py-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                      title="Cancel appointment"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {consult && <ConsultationModal appointment={consult} onClose={() => setConsult(null)} onDone={() => {
        setConsult(null);
        queryClient.invalidateQueries({ queryKey: ["doctor-appointments"] });
      }} />}
    </div>
  );
}

const FREQUENCIES = ["OD", "BD", "TDS", "QID", "SOS", "HS"];

function ConsultationModal({ appointment, onClose, onDone }: { appointment: any; onClose: () => void; onDone: () => void }) {
  const [vitals, setVitals] = useState({ systolic: "", diastolic: "", pulse: "", temperature: "", spO2: "", height: "", weight: "" });
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [icd10Code, setIcd10Code] = useState("");
  const [treatmentPlan, setTreatmentPlan] = useState("");
  const [medSearch, setMedSearch] = useState("");
  const [items, setItems] = useState<Array<{ medicineId: string; name: string; dosage: string; frequency: string; duration: number }>>([]);
  const [instructions, setInstructions] = useState("");
  const [labSearch, setLabSearch] = useState("");
  const [labTests, setLabTests] = useState<Array<{ id: string; name: string; code: string; price: number; unit?: string }>>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: medicines } = useQuery({
    queryKey: ["medicines", medSearch],
    queryFn: async () => {
      const res = await api.get(`/medicines?search=${encodeURIComponent(medSearch)}&limit=8`);
      return res.data.data;
    },
  });

  const addMedicine = (med: any) => {
    if (items.some((i) => i.medicineId === med.id)) return;
    setItems((prev) => [...prev, { medicineId: med.id, name: med.name, dosage: "1 tablet", frequency: "BD", duration: 5 }]);
    setMedSearch("");
  };

  const { data: labCatalog } = useQuery({
    queryKey: ["lab-catalog", labSearch],
    queryFn: async () => {
      const res = await api.get(`/lab/catalog?search=${encodeURIComponent(labSearch)}`);
      return res.data.data;
    },
    enabled: labSearch.trim().length > 0,
  });

  const save = async () => {
    setError("");
    setSaving(true);
    try {
      // Create the medical record
      const recordRes = await api.post("/medical-records", {
        appointmentId: appointment.id,
        vitals: {
          bloodPressureSystolic: vitals.systolic ? parseInt(vitals.systolic) : undefined,
          bloodPressureDiastolic: vitals.diastolic ? parseInt(vitals.diastolic) : undefined,
          pulse: vitals.pulse ? parseInt(vitals.pulse) : undefined,
          temperature: vitals.temperature ? parseFloat(vitals.temperature) : undefined,
          spO2: vitals.spO2 ? parseInt(vitals.spO2) : undefined,
          height: vitals.height ? parseFloat(vitals.height) : undefined,
          weight: vitals.weight ? parseFloat(vitals.weight) : undefined,
        },
        chiefComplaint,
        symptoms,
        diagnosis,
        icd10Code,
        treatmentPlan,
      });

      // Create the prescription if there are items
      if (items.length > 0) {
        await api.post("/prescriptions", {
          medicalRecordId: recordRes.data.data.id,
          instructions,
          items: items.map((i) => ({
            medicineId: i.medicineId,
            dosage: i.dosage,
            frequency: i.frequency,
            duration: i.duration,
            durationUnit: "DAYS",
          })),
        });
      }

      // Order lab tests if the doctor selected any
      if (labTests.length > 0) {
        await api.post("/lab/orders", {
          medicalRecordId: recordRes.data.data.id,
          testCatalogIds: labTests.map((t) => t.id),
          notes: "Ordered during consultation",
        });
      }

      // Mark the appointment in progress then completed
      await api.patch(`/appointments/${appointment.id}/status`, { status: "IN_PROGRESS" });
      await api.patch(`/appointments/${appointment.id}/status`, { status: "COMPLETED" });

      onDone();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to save consultation");
    } finally {
      setSaving(false);
    }
  };

  const vitalsField = (key: keyof typeof vitals, label: string, placeholder: string) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        className="input-field py-1.5 text-sm"
        placeholder={placeholder}
        value={vitals[key]}
        onChange={(e) => setVitals((v) => ({ ...v, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <Modal open onClose={onClose} title={`Consultation — ${appointment.patient?.user.firstName} ${appointment.patient?.user.lastName}`} wide>
      <div className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        <div>
          <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Stethoscope className="w-4 h-4 text-primary-600" /> Vitals
          </h4>
          <div className="grid grid-cols-4 gap-3">
            {vitalsField("systolic", "BP Systolic", "120")}
            {vitalsField("diastolic", "BP Diastolic", "80")}
            {vitalsField("pulse", "Pulse (bpm)", "72")}
            {vitalsField("temperature", "Temp (°F)", "98.6")}
            {vitalsField("spO2", "SpO2 (%)", "98")}
            {vitalsField("height", "Height (cm)", "170")}
            {vitalsField("weight", "Weight (kg)", "70")}
            <div className="flex items-end">
              <p className="text-xs text-gray-400 pb-2">BMI is auto-calculated</p>
            </div>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Clinical Notes</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Chief Complaint</label>
              <input className="input-field text-sm" value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} placeholder="e.g. Fever and body ache for 3 days" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Diagnosis</label>
                <input className="input-field text-sm" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} placeholder="e.g. Viral fever" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">ICD-10 Code</label>
                <input className="input-field text-sm" value={icd10Code} onChange={(e) => setIcd10Code(e.target.value)} placeholder="e.g. J11.1" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Symptoms</label>
              <textarea className="input-field text-sm" rows={2} value={symptoms} onChange={(e) => setSymptoms(e.target.value)} placeholder="Presenting symptoms…" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Treatment Plan</label>
              <textarea className="input-field text-sm" rows={2} value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)} placeholder="Advice, follow-up, lifestyle changes…" />
            </div>
          </div>
        </div>        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Order Lab Tests (optional)</h4>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input-field pl-10 text-sm"
              placeholder="Search lab tests (e.g. blood sugar, HbA1c)…"
              value={labSearch}
              onChange={(e) => setLabSearch(e.target.value)}
            />
            {labSearch && labCatalog?.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
                {labCatalog.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (labTests.some((x) => x.id === t.id)) return;
                      setLabTests((prev) => [
                        ...prev,
                        { id: t.id, name: t.name, code: t.code, price: Number(t.price), unit: t.unit || undefined },
                      ]);
                      setLabSearch("");
                    }}
                    className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-gray-500">{t.category} • {t.sampleType || "Sample"}</p>
                    </div>
                    <span className="text-xs text-gray-400">₹{Number(t.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {labTests.length > 0 && (
            <div className="space-y-1.5 mb-4">
              {labTests.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.code} • ₹{t.price}</p>
                  </div>
                  <button
                    onClick={() => setLabTests((prev) => prev.filter((x) => x.id !== t.id))}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h4 className="text-sm font-semibold text-gray-900 mb-3">Prescription</h4>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input-field pl-10 text-sm"
              placeholder="Search medicine by name…"
              value={medSearch}
              onChange={(e) => setMedSearch(e.target.value)}
            />
            {medSearch && (
              <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                {medicines?.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-gray-500">No medicines found</p>
                ) : (
                  medicines?.map((med: any) => (
                    <button
                      key={med.id}
                      onClick={() => addMedicine(med)}
                      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between gap-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{med.name}</p>
                        <p className="text-xs text-gray-500">{med.genericName} • {med.form}</p>
                      </div>
                      <span className="text-xs text-gray-400">in stock: {med.inStock}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {items.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4 border border-dashed border-gray-200 rounded-lg">
              No medicines added yet — search above to add.
            </p>
          ) : (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={item.medicineId} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2.5">
                  <p className="text-sm font-medium flex-1 min-w-0 truncate">{item.name}</p>
                  <input
                    className="input-field py-1 text-xs w-24"
                    value={item.dosage}
                    onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, dosage: e.target.value } : p)))}
                    title="Dosage"
                  />
                  <select
                    className="input-field py-1 text-xs w-20"
                    value={item.frequency}
                    onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, frequency: e.target.value } : p)))}
                  >
                    {FREQUENCIES.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="input-field py-1 text-xs w-16"
                    value={item.duration}
                    onChange={(e) => setItems((prev) => prev.map((p, i) => (i === idx ? { ...p, duration: parseInt(e.target.value) || 0 } : p)))}
                    title="Duration (days)"
                  />
                  <button
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                    className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">Prescription Instructions</label>
            <input className="input-field text-sm" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Take as directed. Report any side effects…" />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-50">
            {saving ? "Saving…" : "Save Consultation"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
