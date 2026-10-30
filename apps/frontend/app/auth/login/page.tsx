"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { api } from "@/lib/api";
import { ROLE_HOME } from "@/lib/roles";
import { AuthShell } from "@/components/shared/auth-shell";
import { Eye, EyeOff, AlertCircle, Loader2, Sparkles } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;


// Public demo accounts seeded for reviewers (also listed in the README)
const DEMO = [
  { role: "Hospital Admin", email: "admin@medcore.com", password: "Admin@123" },
  { role: "Doctor", email: "dr.rajesh.sharma@medcore.com", password: "Doctor@123" },
  { role: "Nurse", email: "nurse@medcore.com", password: "Nurse@123" },
  { role: "Receptionist", email: "reception@medcore.com", password: "Reception@123" },
  { role: "Lab Technician", email: "labtech@medcore.com", password: "LabTech@123" },
  { role: "Pharmacist", email: "pharmacist@medcore.com", password: "Pharma@123" },
  { role: "Accountant", email: "accountant@medcore.com", password: "Accountant@123" },
  { role: "Patient", email: "rahul.verma@email.com", password: "Patient@123" },
  { role: "Super Admin", email: "superadmin@medcore.com", password: "SuperAdmin@123" },
];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [unverified, setUnverified] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    setError("");
    setUnverified("");
    try {
      const res = await api.post("/auth/login", data);
      const { accessToken, refreshToken, user } = res.data.data;
      setAuth(accessToken, refreshToken, user);
      router.push(ROLE_HOME[user.role] || "/");
    } catch (err: any) {
      const message = err.response?.data?.error?.message || "Login failed";
      if (/verify your email/i.test(message)) setUnverified(data.email);
      setError(message);
      setLoading(false);
    }
  };

  const fillDemo = (d: (typeof DEMO)[number]) => {
    setValue("email", d.email, { shouldValidate: true });
    setValue("password", d.password, { shouldValidate: true });
    setError("");
  };

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to your MedCore workspace.">
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {error}
            {unverified && (
              <>
                {" "}
                <Link href={`/auth/verify-email?email=${encodeURIComponent(unverified)}`} className="font-medium underline">
                  Enter your code
                </Link>
              </>
            )}
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700" htmlFor="email">
            Email
          </label>
          <input id="email" {...register("email")} type="email" autoComplete="email" className="input-field" placeholder="you@hospital.com" />
          {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700" htmlFor="password">
              Password
            </label>
            <Link href="/auth/forgot-password" className="text-xs font-medium text-primary-600 hover:text-primary-700">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              {...register("password")}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="input-field pr-10"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
        </div>

        <button type="submit" disabled={loading} className="btn-primary inline-flex w-full items-center justify-center gap-2 py-2.5 disabled:opacity-60">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        New patient?{" "}
        <Link href="/auth/register" className="font-medium text-primary-600 hover:text-primary-700">
          Create an account
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-dashed border-gray-300 bg-white p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" /> Try a demo account
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEMO.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => fillDemo(d)}
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-primary-50 hover:text-primary-700"
            >
              {d.role}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-400">Fills the form — press Sign in.</p>
      </div>
    </AuthShell>
  );
}
