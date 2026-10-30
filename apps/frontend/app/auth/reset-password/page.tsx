"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { AuthShell } from "@/components/shared/auth-shell";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") || "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const strong = password.length >= 8 && /[A-Z]/.test(password) && /\d/.test(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) return setError("Passwords do not match");
    setLoading(true);
    setError("");
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
      setTimeout(() => router.push("/auth/login"), 1500);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || "Could not reset password");
      setLoading(false);
    }
  };

  if (!token)
    return (
      <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
        This link is missing its token. <Link href="/auth/forgot-password" className="font-medium underline">Request a new one</Link>.
      </p>
    );

  if (done)
    return (
      <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
        <CheckCircle2 className="h-4 w-4" /> Password updated. Signing you in…
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4">
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">New password</span>
        <input type="password" required minLength={8} autoComplete="new-password" className="input-field" value={password} onChange={(e) => setPassword(e.target.value)} />
        <span className={`mt-1 block text-xs ${strong ? "text-green-600" : "text-gray-400"}`}>At least 8 characters, one capital letter and one number.</span>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Confirm password</span>
        <input type="password" required autoComplete="new-password" className="input-field" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </label>
      <button type="submit" disabled={loading || !strong} className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5 disabled:opacity-60">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Update password
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell title="Choose a new password" subtitle="All your other sessions will be signed out.">
      <Suspense>
        <ResetForm />
      </Suspense>
    </AuthShell>
  );
}
