import Link from "next/link";
import { Activity, BedDouble, FlaskConical, HeartPulse, ShieldCheck } from "lucide-react";

const POINTS = [
  { icon: HeartPulse, text: "Encounters, vitals and e-prescriptions in one chart" },
  { icon: FlaskConical, text: "Lab results flagged against reference ranges" },
  { icon: BedDouble, text: "Live bed occupancy across every ward" },
  { icon: ShieldCheck, text: "Encrypted clinical notes and a full audit trail" },
];

/** Split-screen frame shared by sign-in, registration and recovery screens. */
export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-primary-700 via-primary-600 to-medical-600 p-12 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-medical-400/30 blur-3xl" />
        <Link href="/" className="relative flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30">
            <Activity className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">MedCore HMS</span>
        </Link>
        <div className="relative mt-auto max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">One platform for every desk in the hospital.</h2>
          <p className="mt-3 text-primary-100">From the reception queue to the pharmacy counter — role-aware, real-time and built for multi-branch care.</p>
          <ul className="mt-8 space-y-3">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-3 text-sm text-primary-50">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/20">
                  <p.icon className="h-4 w-4" />
                </span>
                {p.text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative mt-12 text-xs text-primary-200">Demo environment · all patient data is fictional</p>
      </div>

      <div className="flex items-center justify-center bg-gray-50 px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-medical-500">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">MedCore HMS</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-gray-500">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
