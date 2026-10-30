"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Modal } from "@/components/shared/modal";
import { Loader2, Search, Stethoscope } from "lucide-react";

/** Request cashless pre-authorisation. Pass `patient` to lock the patient (e.g. from the chart). */
export function PreAuthModal({ open, onClose, patient }: { open: boolean; onClose: () => void; patient?: any }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [picked, setPicked] = useState<any>(patient || null);
  const [form, setForm] = useState({ treatment: "", estimatedAmount: "", insurer: "", tpaName: "", policyNumber: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    if (picked) setForm((f) => ({ ...f, insurer: f.insurer || picked.insuranceProvider || "", policyNumber: f.policyNumber || picked.insurancePolicyNumber || "" }));
  }, [picked]);

  const { data: results } = useQuery({
    queryKey: ["preauth-patient-search", debounced],
    queryFn: async () => (await api.get(`/patients?limit=6&search=${encodeURIComponent(debounced)}`)).data.data,
    enabled: open && !patient && debounced.length >= 2,
  });

  const submit = useMutation({
    mutationFn: async () => (await api.post("/insurance-claims/pre-auth", { patientId: picked.id, ...form, estimatedAmount: Number(form.estimatedAmount) })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pre-auths"] });
      setForm({ treatment: "", estimatedAmount: "", insurer: "", tpaName: "", policyNumber: "" });
      setError("");
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Could not submit the request"),
  });

  return (
    <Modal open={open} onClose={onClose} title="Request cashless pre-authorisation">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          submit.mutate();
        }}
      >
        {patient ? (
          <p className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
            {patient.user?.firstName} {patient.user?.lastName} <span className="font-mono text-xs text-gray-500">{patient.patientId}</span>
          </p>
        ) : (
          <div>
            <span className="mb-1 block text-xs font-medium text-gray-600">Patient</span>
            {picked ? (
              <div className="flex items-center justify-between rounded-lg bg-primary-50 px-3 py-2 text-sm">
                <span>
                  {picked.user.firstName} {picked.user.lastName} <span className="font-mono text-xs text-gray-500">{picked.patientId}</span>
                </span>
                <button type="button" className="text-xs text-primary-700" onClick={() => setPicked(null)}>
                  Change
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input className="input-field pl-9" placeholder="Search patient…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search patient" />
                </div>
                <div className="mt-1 max-h-40 overflow-y-auto">
                  {(results || []).map((p: any) => (
                    <button key={p.id} type="button" onClick={() => setPicked(p)} className={cn("block w-full rounded-lg px-3 py-1.5 text-left text-sm hover:bg-gray-50")}>
                      {p.user.firstName} {p.user.lastName} <span className="font-mono text-xs text-gray-400">{p.patientId}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Planned treatment</span>
          <textarea className="input-field" rows={2} required value={form.treatment} onChange={(e) => setForm({ ...form, treatment: e.target.value })} placeholder="e.g. Knee arthroscopy, 2-day admission" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Estimated cost (₹)</span>
            <input type="number" min="1" className="input-field" required value={form.estimatedAmount} onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Insurer</span>
            <input className="input-field" required value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Policy number</span>
            <input className="input-field" required value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">TPA (optional)</span>
            <input className="input-field" value={form.tpaName} onChange={(e) => setForm({ ...form, tpaName: e.target.value })} />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={!picked || submit.isPending}>
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />} Send request
          </button>
        </div>
      </form>
    </Modal>
  );
}
