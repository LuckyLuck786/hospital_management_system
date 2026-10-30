"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/shared/modal";
import { api } from "@/lib/api";
import { HeartPulse, Loader2 } from "lucide-react";

const FIELDS: Array<{ key: string; label: string; unit: string; step?: string }> = [
  { key: "systolic", label: "Systolic BP", unit: "mmHg" },
  { key: "diastolic", label: "Diastolic BP", unit: "mmHg" },
  { key: "pulse", label: "Pulse", unit: "bpm" },
  { key: "temperature", label: "Temperature", unit: "°F", step: "0.1" },
  { key: "spo2", label: "SpO₂", unit: "%" },
  { key: "respiratoryRate", label: "Resp. rate", unit: "/min" },
  { key: "height", label: "Height", unit: "cm", step: "0.1" },
  { key: "weight", label: "Weight", unit: "kg", step: "0.1" },
];

export function RecordVitalsModal({
  open,
  onClose,
  patientId,
  patientName,
  appointmentId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName?: string;
  appointmentId?: string;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  const h = Number(values.height);
  const w = Number(values.weight);
  const bmi = h > 0 && w > 0 ? (w / Math.pow(h / 100, 2)).toFixed(1) : null;

  const save = useMutation({
    mutationFn: async () => (await api.post(`/patients/${patientId}/vitals`, { ...values, notes, appointmentId })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vitals", patientId] });
      setValues({});
      setNotes("");
      setError("");
      onSaved?.();
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Could not save vitals"),
  });

  return (
    <Modal open={open} onClose={onClose} title={`Record vitals${patientName ? ` — ${patientName}` : ""}`}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <label key={f.key} className="block">
              <span className="mb-1 block text-xs font-medium text-gray-600">
                {f.label} <span className="text-gray-400">({f.unit})</span>
              </span>
              <input
                type="number"
                step={f.step || "1"}
                min="0"
                className="input-field"
                value={values[f.key] || ""}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        {bmi && (
          <div className="flex items-center gap-2 rounded-lg bg-medical-50 px-3 py-2 text-sm text-medical-600">
            <HeartPulse className="h-4 w-4" /> BMI will be recorded as <strong>{bmi}</strong>
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Observations</span>
          <textarea className="input-field" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Patient reports mild dizziness" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save vitals
          </button>
        </div>
      </form>
    </Modal>
  );
}
