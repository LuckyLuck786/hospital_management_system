"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { Modal } from "@/components/shared/modal";
import { LoadingState, EmptyState, ErrorState } from "@/components/shared/states";
import { roleLabel, formatDate, ALL_ROLES } from "@/lib/roles";
import { StatusBadge } from "@/components/shared/status-badge";
import { Users, UserPlus, Search, AlertCircle } from "lucide-react";

export default function AdminUsersPage() {
  const [roleFilter, setRoleFilter] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["users", roleFilter, search, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: "15" });
      if (roleFilter) params.set("role", roleFilter);
      if (search) params.set("search", search);
      const res = await api.get(`/users?${params}`);
      return res.data;
    },
  });

  const users = data?.data || [];
  const meta = data?.meta;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage hospital staff, doctors, patients, and admin accounts."
        actions={
          <button onClick={() => setCreateOpen(true)} className="btn-primary flex items-center gap-2">
            <UserPlus className="w-4 h-4" /> Add User
          </button>
        }
      />

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email…"
            className="input-field pl-10"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => {
            setRoleFilter(e.target.value);
            setPage(1);
          }}
          className="input-field max-w-[180px]"
        >
          <option value="">All roles</option>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState message="Could not load users." onRetry={() => refetch()} />
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No users found"
            description="Try adjusting your search or add a new user."
          />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200 bg-gray-50">
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Phone</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 text-xs font-bold">
                        {u.firstName?.[0]}
                        {u.lastName?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">
                          {u.firstName} {u.lastName}
                        </p>
                        <p className="text-xs text-gray-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-50 text-primary-700">
                      {roleLabel(u.role)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{u.phone || "—"}</td>
                  <td className="px-6 py-3">
                    {u.isActive ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-gray-500">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-500">
              Page {meta.page} of {meta.totalPages} · {meta.total} users
            </p>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="btn-secondary text-xs disabled:opacity-40"
              >
                Previous
              </button>
              <button
                disabled={page >= meta.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="btn-secondary text-xs disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <CreateUserModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => queryClient.invalidateQueries({ queryKey: ["users"] })} />
    </div>
  );
}

function CreateUserModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "Welcome@123",
    role: "DOCTOR",
    specialization: "",
    departmentId: "",
    qualification: "",
    consultationFee: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => (await api.get("/departments")).data.data,
  });

  const submit = async () => {
    setError("");
    setLoading(true);
    try {
      const payload: any = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        password: form.password,
        role: form.role,
      };
      if (form.role === "DOCTOR") {
        payload.specialization = form.specialization;
        payload.departmentId = form.departmentId;
        payload.qualification = form.qualification;
        payload.consultationFee = parseFloat(form.consultationFee) || undefined;
      }
      await api.post("/users", payload);
      onCreated();
      onClose();
      setForm({ firstName: "", lastName: "", email: "", phone: "", password: "Welcome@123", role: "DOCTOR", specialization: "", departmentId: "", qualification: "", consultationFee: "" });
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <Modal open={open} onClose={onClose} title="Add New User">
      <div className="space-y-4">
        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            <input className="input-field" placeholder="Jane" {...field("firstName")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            <input className="input-field" placeholder="Doe" {...field("lastName")} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" className="input-field" placeholder="jane@medcore.com" {...field("email")} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input className="input-field" placeholder="+91-9876543210" {...field("phone")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="input-field" {...field("role")}>
              {ALL_ROLES.filter((r) => r !== "SUPER_ADMIN" && r !== "PATIENT").map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {form.role === "DOCTOR" && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialization</label>
                <input className="input-field" placeholder="Cardiology" {...field("specialization")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                <select className="input-field" {...field("departmentId")}>
                  <option value="">Select department</option>
                  {departments?.map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Qualification</label>
                <input className="input-field" placeholder="MBBS, MD" {...field("qualification")} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee (₹)</label>
                <input type="number" className="input-field" placeholder="500" {...field("consultationFee")} />
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button onClick={submit} disabled={loading} className="btn-primary disabled:opacity-50">
            {loading ? "Creating…" : "Create User"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
