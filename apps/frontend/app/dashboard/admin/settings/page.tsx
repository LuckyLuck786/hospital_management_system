"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { useAuthStore } from "@/store/auth-store";
import { roleLabel } from "@/lib/roles";
import { Shield, Bell, UserCircle, CheckCircle2 } from "lucide-react";

export default function AdminSettingsPage() {
  const { user } = useAuthStore();
  const [emailPref, setEmailPref] = useState(true);
  const [smsPref, setSmsPref] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" description="Manage your profile and notification preferences." />

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <UserCircle className="w-5 h-5 text-primary-600" /> Profile
        </h3>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input className="input-field" defaultValue={`${user?.firstName} ${user?.lastName}`} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input className="input-field" defaultValue={user?.email} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <input className="input-field" defaultValue={roleLabel(user?.role || "")} disabled />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hospital ID</label>
            <input className="input-field font-mono text-xs" defaultValue={user?.hospitalId || "—"} disabled />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-600" /> Notification Preferences
        </h3>
        <div className="space-y-4 mt-4">
          {[
            { label: "Email notifications", desc: "Appointment confirmations, lab reports, invoices", value: emailPref, set: setEmailPref },
            { label: "SMS notifications", desc: "Critical alerts and appointment reminders", value: smsPref, set: setSmsPref },
          ].map((pref) => (
            <div key={pref.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">{pref.label}</p>
                <p className="text-xs text-gray-500">{pref.desc}</p>
              </div>
              <button
                onClick={() => pref.set(!pref.value)}
                className={`relative w-11 h-6 rounded-full transition-colors ${pref.value ? "bg-primary-600" : "bg-gray-200"}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${pref.value ? "left-[22px]" : "left-0.5"}`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary-600" /> Security
        </h3>
        <p className="text-sm text-gray-500 mt-2">
          Passwords are hashed with bcrypt (cost 12). Refresh tokens are rotated on every use and can be
          revoked per device. Session secrets are managed via environment variables.
        </p>
        <div className="mt-4 flex gap-3">
          <button onClick={save} className="btn-primary">
            {saved ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Saved
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
