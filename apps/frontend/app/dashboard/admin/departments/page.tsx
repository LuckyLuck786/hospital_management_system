"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/shared/modal";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { Building2, Plus, Stethoscope, AlertCircle } from "lucide-react";

export default function AdminDepartmentsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: departments, isLoading, isError, refetch } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get("/departments")).data.data,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Organise doctors and services by clinical department."
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Add Department
          </button>
        }
      />

      {isLoading ? (
        <LoadingState />
      ) : isError ? (
        <ErrorState message="Could not load departments." onRetry={() => refetch()} />
      ) : departments?.length === 0 ? (
        <EmptyState icon={Building2} title="No departments yet" description="Create your first department to get started." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {departments.map((d: any) => (
            <div key={d.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary-600" />
                </div>
                {d.code && (
                  <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-1 rounded-md">
                    {d.code}
                  </span>
                )}
              </div>
              <h3 className="font-semibold text-gray-900 mt-3">{d.name}</h3>
              {d.description && <p className="text-sm text-gray-500 mt-1">{d.description}</p>}
              <div className="flex items-center gap-1.5 mt-3 text-sm text-gray-500">
                <Stethoscope className="w-4 h-4" />
                {d._count?.doctors || 0} doctors
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateDepartmentModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ["departments"] })}
      />
    </div>
  );
}

function CreateDepartmentModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", code: "", description: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      await api.post("/departments", form);
      onCreated();
      onClose();
      setForm({ name: "", code: "", description: "" });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to create department");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Department">
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            className="input-field"
            placeholder="Cardiology"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
          <input
            className="input-field"
            placeholder="CARD"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea
            className="input-field"
            rows={3}
            placeholder="Heart and cardiovascular care"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={submit} disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? "Creating…" : "Create Department"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
