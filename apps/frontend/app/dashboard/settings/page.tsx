"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { roleLabel } from "@/lib/roles";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { BadgeCheck, CheckCircle2, KeyRound, Loader2, Phone, Shield, UserCircle } from "lucide-react";

const BLOOD = ["A_POSITIVE", "A_NEGATIVE", "B_POSITIVE", "B_NEGATIVE", "AB_POSITIVE", "AB_NEGATIVE", "O_POSITIVE", "O_NEGATIVE"];

export default function SettingsPage() {
  const qc = useQueryClient();
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const [form, setForm] = useState({ firstName: "", lastName: "", phone: "", gender: "", bloodGroup: "", dateOfBirth: "" });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [phoneMsg, setPhoneMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const { data: me, isLoading, isError, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/users/me")).data.data,
  });

  useEffect(() => {
    if (me)
      setForm({
        firstName: me.firstName || "",
        lastName: me.lastName || "",
        phone: me.phone || "",
        gender: me.gender || "",
        bloodGroup: me.bloodGroup || "",
        dateOfBirth: me.dateOfBirth ? String(me.dateOfBirth).slice(0, 10) : "",
      });
  }, [me]);

  const save = useMutation({
    mutationFn: async () => (await api.patch(`/users/${me.id}`, form)).data.data,
    onSuccess: (u) => {
      qc.invalidateQueries({ queryKey: ["me"] });
      if (user && accessToken && refreshToken) setAuth(accessToken, refreshToken, { ...user, firstName: u.firstName, lastName: u.lastName });
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Could not save profile"),
  });

  const sendOtp = useMutation({
    mutationFn: async () => (await api.post("/auth/send-phone-otp")).data,
    onSuccess: () => {
      setOtpSent(true);
      setPhoneMsg({ ok: true, text: "We sent a 6-digit code by SMS. It expires in 10 minutes." });
    },
    onError: (e: any) => setPhoneMsg({ ok: false, text: e.response?.data?.error?.message || "Could not send the code" }),
  });
  const verify = useMutation({
    mutationFn: async () => (await api.post("/auth/verify-phone", { otp })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      setOtpSent(false);
      setOtp("");
      setPhoneMsg({ ok: true, text: "Phone number verified." });
    },
    onError: (e: any) => setPhoneMsg({ ok: false, text: e.response?.data?.error?.message || "Invalid or expired code" }),
  });

  if (isLoading) return <LoadingState />;
  if (isError || !me) return <ErrorState message="Could not load your account." onRetry={() => refetch()} />;

  const phoneChanged = form.phone !== (me.phone || "");

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description="Your profile, contact verification and account security." />

      <form
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <UserCircle className="h-5 w-5 text-primary-600" /> Profile
        </h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">First name</span>
            <input className="input-field" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Last name</span>
            <input className="input-field" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
            <input className="input-field bg-gray-50" value={me.email} disabled />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Role</span>
            <input className="input-field bg-gray-50" value={roleLabel(me.role)} disabled />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Phone</span>
            <input className="input-field" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91 98765 43210" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Date of birth</span>
            <input className="input-field" type="date" value={form.dateOfBirth} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Gender</span>
            <select className="input-field" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">Prefer not to say</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Blood group</span>
            <select className="input-field" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}>
              <option value="">Unknown</option>
              {BLOOD.map((b) => (
                <option key={b} value={b}>
                  {b.replace("_POSITIVE", "+").replace("_NEGATIVE", "−")}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <div className="mt-5 flex items-center justify-end gap-3">
          {saved && (
            <span className="inline-flex items-center gap-1 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          )}
          <button type="submit" className="btn-primary inline-flex items-center gap-2" disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Phone className="h-5 w-5 text-primary-600" /> Contact verification
        </h3>
        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
            <span>Email · {me.email}</span>
            {me.isEmailVerified ? (
              <span className="inline-flex items-center gap-1 font-medium text-green-600">
                <BadgeCheck className="h-4 w-4" /> Verified
              </span>
            ) : (
              <span className="text-amber-600">Not verified</span>
            )}
          </div>
          <div className="rounded-lg bg-gray-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span>Phone · {me.phone || "not set"}</span>
              {me.isPhoneVerified ? (
                <span className="inline-flex items-center gap-1 font-medium text-green-600">
                  <BadgeCheck className="h-4 w-4" /> Verified
                </span>
              ) : me.phone && !phoneChanged ? (
                <button type="button" className="btn-secondary text-sm" onClick={() => sendOtp.mutate()} disabled={sendOtp.isPending}>
                  {sendOtp.isPending ? "Sending…" : otpSent ? "Resend code" : "Send code"}
                </button>
              ) : (
                <span className="text-gray-400">{phoneChanged ? "Save your new number first" : "Add a phone number"}</span>
              )}
            </div>
            {otpSent && !me.isPhoneVerified && (
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  verify.mutate();
                }}
              >
                <input
                  className="input-field max-w-[10rem] text-center font-mono tracking-[0.3em]"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  aria-label="SMS code"
                />
                <button className="btn-primary" disabled={otp.length !== 6 || verify.isPending}>
                  Verify
                </button>
              </form>
            )}
            {phoneMsg && <p className={`mt-2 text-xs ${phoneMsg.ok ? "text-green-600" : "text-red-600"}`}>{phoneMsg.text}</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="flex items-center gap-2 font-semibold text-gray-900">
          <Shield className="h-5 w-5 text-primary-600" /> Security
        </h3>
        <ul className="mt-4 space-y-2 text-sm text-gray-600">
          <li className="flex gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> Passwords are hashed with bcrypt (cost 12). Forgot it? Use “Forgot password” on the sign-in page.
          </li>
          <li className="flex gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> Sessions use 15-minute access tokens and single-use refresh tokens that rotate on every refresh.
          </li>
          <li className="flex gap-2">
            <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" /> Every change you make is written to the hospital audit log.
          </li>
        </ul>
      </div>
    </div>
  );
}
