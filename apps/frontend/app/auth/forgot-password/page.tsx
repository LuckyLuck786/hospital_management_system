"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { AuthShell } from "@/components/shared/auth-shell";
import { CheckCircle2, Loader2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
    } finally {
      // Same message whether or not the account exists
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {sent ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-green-50 px-4 py-4 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <span>
              If an account exists for <strong>{email}</strong>, a reset link is on its way. It expires in one hour.
            </span>
          </div>
          <Link href="/auth/login" className="btn-secondary block w-full text-center">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
            <input type="email" required autoComplete="email" className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <button type="submit" disabled={loading} className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link
          </button>
          <p className="text-center text-sm text-gray-500">
            Remembered it?{" "}
            <Link href="/auth/login" className="font-medium text-primary-600 hover:text-primary-700">
              Sign in
            </Link>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
