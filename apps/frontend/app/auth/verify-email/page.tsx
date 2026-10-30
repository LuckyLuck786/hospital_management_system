"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { AuthShell } from "@/components/shared/auth-shell";
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react";

function VerifyForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      await api.post("/auth/verify-email", { email, otp });
      setStatus({ ok: true, text: "Email verified. Taking you to sign in…" });
      setTimeout(() => router.push("/auth/login"), 1200);
    } catch (err: any) {
      setStatus({ ok: false, text: err.response?.data?.error?.message || "Verification failed" });
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      await api.post("/auth/resend-verification", { email });
      setStatus({ ok: true, text: "A new code is on its way. Check your inbox and spam folder." });
    } finally {
      setResending(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">
        <MailCheck className="h-5 w-5 shrink-0" /> Enter the 6-digit code we emailed you. It expires in 15 minutes.
      </div>
      {status && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${status.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {status.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />} {status.text}
        </div>
      )}
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Email</span>
        <input type="email" required className="input-field" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium text-gray-700">Verification code</span>
        <input
          required
          inputMode="numeric"
          maxLength={6}
          className="input-field text-center font-mono text-lg tracking-[0.5em]"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
          placeholder="000000"
        />
      </label>
      <button type="submit" disabled={loading || otp.length !== 6} className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5 disabled:opacity-60">
        {loading && <Loader2 className="h-4 w-4 animate-spin" />} Verify email
      </button>
      <p className="text-center text-sm text-gray-500">
        Didn&apos;t get it?{" "}
        <button type="button" onClick={resend} disabled={!email || resending} className="font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50">
          {resending ? "Sending…" : "Send a new code"}
        </button>
        {" · "}
        <Link href="/auth/login" className="font-medium text-primary-600 hover:text-primary-700">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell title="Verify your email" subtitle="One last step before you can sign in.">
      <Suspense>
        <VerifyForm />
      </Suspense>
    </AuthShell>
  );
}
