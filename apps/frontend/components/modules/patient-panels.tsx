"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { doctorName, formatDate } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/shared/modal";
import { EmptyState, ErrorState, LoadingState } from "@/components/shared/states";
import { RecordVitalsModal } from "@/components/modules/record-vitals-modal";
import {
  Activity,
  FileText,
  HeartPulse,
  Loader2,
  Paperclip,
  Plus,
  Syringe,
  Thermometer,
  Upload,
  Wind,
  Scale,
} from "lucide-react";

const n = (v: any) => (v == null ? null : Number(v));

/* ------------------------------------------------------------------ Vitals */

export function VitalsPanel({ patientId, canRecord, patientName }: { patientId: string; canRecord?: boolean; patientName?: string }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["vitals", patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/vitals?limit=30`)).data.data as any[],
  });

  const vitals = data || [];
  const latest = vitals[0];
  const series = [...vitals]
    .reverse()
    .map((v) => ({
      date: new Date(v.recordedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      Systolic: n(v.systolic),
      Diastolic: n(v.diastolic),
      Pulse: n(v.pulse),
      SpO2: n(v.spo2),
    }));

  const tiles = latest
    ? [
        { label: "Blood pressure", value: latest.systolic ? `${latest.systolic}/${latest.diastolic ?? "—"}` : "—", unit: "mmHg", icon: HeartPulse, warn: n(latest.systolic)! >= 140 || n(latest.diastolic)! >= 90 },
        { label: "Pulse", value: latest.pulse ?? "—", unit: "bpm", icon: Activity, warn: n(latest.pulse)! > 100 || (latest.pulse != null && n(latest.pulse)! < 50) },
        { label: "Temperature", value: latest.temperature ?? "—", unit: "°F", icon: Thermometer, warn: n(latest.temperature)! >= 100.4 },
        { label: "SpO₂", value: latest.spo2 ?? "—", unit: "%", icon: Wind, warn: latest.spo2 != null && n(latest.spo2)! < 94 },
        { label: "BMI", value: latest.bmi ?? "—", unit: "kg/m²", icon: Scale, warn: n(latest.bmi)! >= 30 },
      ]
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Vital signs</h3>
          <p className="text-sm text-gray-500">
            {latest ? `Last recorded ${new Date(latest.recordedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}` : "No observations yet"}
          </p>
        </div>
        {canRecord && (
          <button className="btn-primary inline-flex items-center gap-2 text-sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Record vitals
          </button>
        )}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load vitals." onRetry={() => refetch()} />
      ) : vitals.length === 0 ? (
        <EmptyState icon={HeartPulse} title="No vitals recorded" description={canRecord ? "Record the first set of observations." : "Your care team records these during visits."} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {tiles.map((t) => (
              <div key={t.label} className={cn("rounded-xl border p-3", t.warn ? "border-amber-200 bg-amber-50" : "border-gray-200 bg-white")}>
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <t.icon className={cn("h-3.5 w-3.5", t.warn ? "text-amber-600" : "text-primary-500")} /> {t.label}
                </div>
                <p className={cn("mt-1 text-xl font-semibold", t.warn ? "text-amber-700" : "text-gray-900")}>
                  {t.value} <span className="text-xs font-normal text-gray-400">{t.unit}</span>
                </p>
              </div>
            ))}
          </div>
          {series.length > 1 && (
            <div className="h-64 rounded-xl border border-gray-200 bg-white p-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip contentStyle={{ borderRadius: 12, borderColor: "#e2e8f0", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="Systolic" stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Diastolic" stroke="#93c5fd" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Pulse" stroke="#14b8a6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="SpO2" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">BP</th>
                  <th className="px-3 py-2 font-medium">Pulse</th>
                  <th className="px-3 py-2 font-medium">Temp</th>
                  <th className="px-3 py-2 font-medium">SpO₂</th>
                  <th className="px-3 py-2 font-medium">BMI</th>
                  <th className="px-3 py-2 font-medium">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vitals.slice(0, 8).map((v) => (
                  <tr key={v.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-gray-600">{new Date(v.recordedAt).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}</td>
                    <td className="px-3 py-2">{v.systolic ? `${v.systolic}/${v.diastolic ?? "—"}` : "—"}</td>
                    <td className="px-3 py-2">{v.pulse ?? "—"}</td>
                    <td className="px-3 py-2">{v.temperature ?? "—"}</td>
                    <td className="px-3 py-2">{v.spo2 ?? "—"}</td>
                    <td className="px-3 py-2">{v.bmi ?? "—"}</td>
                    <td className="max-w-xs truncate px-3 py-2 text-gray-500">{v.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {canRecord && <RecordVitalsModal open={open} onClose={() => setOpen(false)} patientId={patientId} patientName={patientName} />}
    </div>
  );
}

/* ------------------------------------------------------------ Vaccinations */

export function VaccinationsPanel({ patientId, canRecord }: { patientId: string; canRecord?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ vaccineName: "", doseNumber: "", administeredOn: new Date().toISOString().slice(0, 10), batchNumber: "", nextDueDate: "", notes: "" });
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["vaccinations", patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}/vaccinations`)).data.data as any[],
  });

  const add = useMutation({
    mutationFn: async () => (await api.post(`/patients/${patientId}/vaccinations`, form)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vaccinations", patientId] });
      setOpen(false);
      setForm((f) => ({ ...f, vaccineName: "", doseNumber: "", batchNumber: "", nextDueDate: "", notes: "" }));
      setError("");
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Could not save vaccination"),
  });

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">Immunisation history</h3>
          <p className="text-sm text-gray-500">Vaccines given, batch numbers and upcoming doses.</p>
        </div>
        {canRecord && (
          <button className="btn-primary inline-flex items-center gap-2 text-sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Add vaccination
          </button>
        )}
      </div>
      {isLoading ? (
        <LoadingState />
      ) : !data?.length ? (
        <EmptyState icon={Syringe} title="No vaccinations on file" />
      ) : (
        <ol className="relative space-y-3 border-l border-gray-200 pl-5">
          {data.map((v) => {
            const due = v.nextDueDate ? String(v.nextDueDate).slice(0, 10) : null;
            const overdue = due && due < today;
            return (
              <li key={v.id} className="relative">
                <span className="absolute -left-[27px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-medical-500 ring-1 ring-medical-200" />
                <div className="rounded-xl border border-gray-200 bg-white p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium text-gray-900">
                      {v.vaccineName}
                      {v.doseNumber ? <span className="ml-2 text-xs font-normal text-gray-500">Dose {v.doseNumber}</span> : null}
                    </p>
                    <span className="text-xs text-gray-500">{formatDate(v.administeredOn)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {v.batchNumber && <span>Batch {v.batchNumber}</span>}
                    {due && (
                      <span className={cn("font-medium", overdue ? "text-red-600" : "text-medical-600")}>
                        {overdue ? "Overdue since" : "Next dose"} {formatDate(due)}
                      </span>
                    )}
                    {v.notes && <span>{v.notes}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Record vaccination">
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Vaccine</span>
            <input className="input-field" required value={form.vaccineName} onChange={(e) => setForm({ ...form, vaccineName: e.target.value })} placeholder="e.g. Hepatitis B" list="vaccine-options" />
            <datalist id="vaccine-options">
              {["Hepatitis B", "Influenza (seasonal)", "Tetanus-diphtheria (Td)", "COVID-19 booster", "MMR", "Typhoid conjugate", "HPV", "Pneumococcal (PCV13)"].map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Date given</span>
              <input type="date" required className="input-field" value={form.administeredOn} max={today} onChange={(e) => setForm({ ...form, administeredOn: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Dose #</span>
              <input type="number" min="1" className="input-field" value={form.doseNumber} onChange={(e) => setForm({ ...form, doseNumber: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Batch number</span>
              <input className="input-field" value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: e.target.value })} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">Next due</span>
              <input type="date" className="input-field" value={form.nextDueDate} min={form.administeredOn} onChange={(e) => setForm({ ...form, nextDueDate: e.target.value })} />
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={add.isPending}>
              {add.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

/* ---------------------------------------------------------- Family history */

const FAMILY_FLAGS: Array<{ key: string; label: string }> = [
  { key: "familyHistoryDiabetes", label: "Diabetes" },
  { key: "familyHistoryHypertension", label: "Hypertension" },
  { key: "familyHistoryCancer", label: "Cancer" },
  { key: "familyHistoryCardiac", label: "Cardiac disease" },
];

export function FamilyHistoryPanel({ patient, canEdit }: { patient: any; canEdit?: boolean }) {
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => (await api.patch(`/patients/${patient.id}/family-history`, { [key]: value })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["patient", patient.id] }),
  });
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Family history</h4>
      <div className="flex flex-wrap gap-2">
        {FAMILY_FLAGS.map((f) => {
          const on = Boolean(patient[f.key]);
          return (
            <button
              key={f.key}
              type="button"
              disabled={!canEdit || toggle.isPending}
              onClick={() => toggle.mutate({ key: f.key, value: !on })}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors",
                on ? "bg-rose-50 text-rose-700 ring-rose-200" : "bg-gray-50 text-gray-500 ring-gray-200",
                canEdit ? "cursor-pointer hover:ring-primary-300" : "cursor-default",
              )}
              title={canEdit ? "Click to toggle" : undefined}
            >
              {on ? "● " : "○ "}
              {f.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ----------------------------------------------------- Records + attachments */

export function RecordsPanel({ patientId, canUpload }: { patientId: string; canUpload?: boolean }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [target, setTarget] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["patient-records", patientId],
    queryFn: async () => (await api.get(`/medical-records/patient/${patientId}`)).data.data as any[],
  });

  const upload = useMutation({
    mutationFn: async ({ recordId, file }: { recordId: string; file: File }) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post(`/medical-records/${recordId}/attachments`, fd, { headers: { "Content-Type": "multipart/form-data" } })).data;
    },
    onSuccess: () => {
      setUploadError("");
      qc.invalidateQueries({ queryKey: ["patient-records", patientId] });
    },
    onError: (e: any) => setUploadError(e.response?.data?.error?.message || "Upload failed"),
  });

  const openAttachment = async (recordId: string, attachmentId: string) => {
    const res = await api.get(`/medical-records/${recordId}/attachments/${attachmentId}/url`);
    window.open(res.data.data.url, "_blank", "noopener");
  };

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Could not load medical records." onRetry={() => refetch()} />;
  if (!data?.length) return <EmptyState icon={FileText} title="No medical records yet" description="Records appear after a completed consultation." />;

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && target) upload.mutate({ recordId: target, file });
          e.target.value = "";
        }}
      />
      {uploadError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{uploadError}</p>}
      {data.map((r) => (
        <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-medium text-gray-900">{r.chiefComplaint || "Consultation"}</p>
              <p className="text-xs text-gray-500">
                {formatDate(r.createdAt)} · {doctorName(r.doctor?.user)} · <span className="font-mono">{r.recordNumber}</span>
              </p>
            </div>
            {r.icd10Code && <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-mono text-xs text-indigo-700">ICD-10 {r.icd10Code}</span>}
          </div>
          <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            {r.diagnosis && (
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Diagnosis</p>
                <p className="text-gray-800">{r.diagnosis}</p>
              </div>
            )}
            {r.treatmentPlan && (
              <div>
                <p className="text-xs font-medium uppercase text-gray-400">Treatment plan</p>
                <p className="text-gray-800">{r.treatmentPlan}</p>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            {(r.attachments || []).map((a: any) => (
              <button
                key={a.id}
                onClick={() => openAttachment(r.id, a.id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 hover:border-primary-300 hover:text-primary-700"
              >
                <Paperclip className="h-3.5 w-3.5" /> {a.fileName}
              </button>
            ))}
            {!r.attachments?.length && <span className="text-xs text-gray-400">No attachments</span>}
            {canUpload && (
              <button
                onClick={() => {
                  setTarget(r.id);
                  fileRef.current?.click();
                }}
                disabled={upload.isPending}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50"
              >
                {upload.isPending && target === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Attach file
              </button>
            )}
          </div>
        </div>
      ))}
      {canUpload && <p className="text-xs text-gray-400">PDF, PNG, JPG, WEBP or TXT · up to 20 MB · stored privately, opened through expiring links.</p>}
    </div>
  );
}
