"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/roles";
import { Modal } from "@/components/shared/modal";
import { Loader2, ShieldCheck } from "lucide-react";

const INSURERS = ["Star Health", "HDFC ERGO", "ICICI Lombard", "Niva Bupa", "Care Health", "New India Assurance", "Aditya Birla Health", "Bajaj Allianz"];
const TPAS = ["MediAssist", "Paramount Health", "Vidal Health", "Health India TPA", "FHPL", "Raksha TPA"];

/** File an insurance / TPA claim for an unpaid invoice. Pass an invoice to lock the choice. */
export function FileClaimModal({ open, onClose, invoice }: { open: boolean; onClose: () => void; invoice?: any }) {
  const qc = useQueryClient();
  const [invoiceId, setInvoiceId] = useState(invoice?.id || "");
  const [form, setForm] = useState({ insurer: "", tpaName: "", policyNumber: "", claimedAmount: "", notes: "" });
  const [error, setError] = useState("");

  const { data: unpaid } = useQuery({
    queryKey: ["claimable-invoices"],
    queryFn: async () => {
      const [fin, part] = await Promise.all([api.get("/invoices?status=FINALIZED&limit=100"), api.get("/invoices?status=PARTIALLY_PAID&limit=100")]);
      return [...part.data.data, ...fin.data.data];
    },
    enabled: open && !invoice,
  });

  const selected = invoice || (unpaid || []).find((i: any) => i.id === invoiceId);

  // Pre-fill policy details already stored on the patient
  const patientId = selected?.patientId;
  const { data: patient } = useQuery({
    queryKey: ["patient", patientId],
    queryFn: async () => (await api.get(`/patients/${patientId}`)).data.data,
    enabled: open && !!patientId,
  });
  useEffect(() => {
    if (!selected) return;
    setForm((f) => ({
      ...f,
      insurer: f.insurer || patient?.insuranceProvider || "",
      policyNumber: f.policyNumber || patient?.insurancePolicyNumber || "",
      claimedAmount: String(Number(selected.balanceAmount)),
    }));
  }, [selected?.id, patient?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const file = useMutation({
    mutationFn: async () =>
      (await api.post("/insurance-claims", { invoiceId: selected.id, ...form, claimedAmount: Number(form.claimedAmount) })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["claims"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setError("");
      setForm({ insurer: "", tpaName: "", policyNumber: "", claimedAmount: "", notes: "" });
      onClose();
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Could not file the claim"),
  });

  return (
    <Modal open={open} onClose={onClose} title="File insurance claim">
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          file.mutate();
        }}
      >
        {invoice ? (
          <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
            <span className="font-mono text-xs text-gray-500">{invoice.invoiceNumber}</span> · {invoice.patient?.user?.firstName} {invoice.patient?.user?.lastName} ·{" "}
            balance <strong>{formatCurrency(invoice.balanceAmount)}</strong>
          </div>
        ) : (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Invoice</span>
            <select className="input-field" required value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
              <option value="">Select an unpaid invoice…</option>
              {(unpaid || []).map((i: any) => (
                <option key={i.id} value={i.id}>
                  {i.invoiceNumber} — {i.patient?.user?.firstName} {i.patient?.user?.lastName} — {formatCurrency(i.balanceAmount)} due
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Insurer</span>
            <input className="input-field" required list="insurers" value={form.insurer} onChange={(e) => setForm({ ...form, insurer: e.target.value })} />
            <datalist id="insurers">{INSURERS.map((i) => <option key={i} value={i} />)}</datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">TPA (optional)</span>
            <input className="input-field" list="tpas" value={form.tpaName} onChange={(e) => setForm({ ...form, tpaName: e.target.value })} />
            <datalist id="tpas">{TPAS.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Policy number</span>
            <input className="input-field" required value={form.policyNumber} onChange={(e) => setForm({ ...form, policyNumber: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-gray-600">Claim amount (₹)</span>
            <input
              type="number"
              min="1"
              step="0.01"
              max={selected ? Number(selected.balanceAmount) : undefined}
              className="input-field"
              required
              value={form.claimedAmount}
              onChange={(e) => setForm({ ...form, claimedAmount: e.target.value })}
            />
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-gray-600">Notes for the insurer</span>
          <textarea className="input-field" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Diagnosis summary, pre-authorisation number…" />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={file.isPending || !selected}>
            {file.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Submit claim
          </button>
        </div>
      </form>
    </Modal>
  );
}
