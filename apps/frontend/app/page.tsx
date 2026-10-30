import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BedDouble,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileLock2,
  FlaskConical,
  HeartPulse,
  LineChart,
  Pill,
  ShieldCheck,
  Stethoscope,
  Users,
  Zap,
} from "lucide-react";

const API_DOCS = process.env.NEXT_PUBLIC_API_DOCS_URL || "https://medcore-api-production-b18a.up.railway.app/api/docs";

const FEATURES = [
  { icon: CalendarCheck, title: "Conflict-free scheduling", text: "Weekly doctor templates, 60-second slot cache and database-level guards so a slot is never double-booked — even under load." },
  { icon: Stethoscope, title: "Encounter-first EMR", text: "Vitals, auto-BMI, ICD-10 diagnoses, allergies, vaccinations, family history and file attachments in one append-only chart." },
  { icon: Pill, title: "E-prescriptions & pharmacy", text: "Search live stock while prescribing, print signed PDFs, and dispense FIFO by batch with expiry quarantine." },
  { icon: FlaskConical, title: "Laboratory workflow", text: "Order → sample → processing → results → approval, with out-of-range values flagged against gender-specific ranges." },
  { icon: CreditCard, title: "Unified billing", text: "Consultation, lab and pharmacy charges roll into one invoice. Patients pay by UPI, card or netbanking via Razorpay." },
  { icon: BedDouble, title: "Wards & beds", text: "Live occupancy per department, admit and discharge in one click, and heat-mapped capacity on the admin dashboard." },
  { icon: LineChart, title: "Analytics", text: "Revenue trends, appointment volume, patient growth and department load for admins and finance." },
  { icon: Zap, title: "Real-time alerts", text: "Socket.IO notifications, email and SMS reminders 24 h and 1 h before visits, low-stock and expiry alerts." },
];

const ROLES = [
  { role: "Doctors", text: "Today's timeline, consultations, lab approvals and their own weekly schedule." },
  { role: "Nurses", text: "Triage vitals, ward rounds and bed management." },
  { role: "Reception", text: "Registration, bookings, check-in and counter payments." },
  { role: "Lab", text: "Sample queue, structured results and report sign-off." },
  { role: "Pharmacy", text: "Dispense queue, inventory, batches and expiry tracking." },
  { role: "Finance", text: "Invoices, collections and revenue reporting." },
  { role: "Admins", text: "Departments, staff, wards, analytics and the audit log." },
  { role: "Patients", text: "Book visits, read reports, track vitals and pay online." },
];

const SECURITY = [
  "Row-level multi-tenancy — every query is scoped to the caller's hospital",
  "AES-256-GCM encryption for diagnoses and clinical notes",
  "Audit log of every create, update and delete",
  "Rotating refresh tokens, bcrypt-12 passwords, email and SMS OTP",
  "Rate limiting, Helmet headers and strict CORS",
  "Private file storage with expiring download links",
];

export default function Home() {
  return (
    <main className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-medical-500 shadow-sm">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-bold">MedCore HMS</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm text-gray-600 md:flex">
            <a href="#features" className="hover:text-gray-900">Features</a>
            <a href="#roles" className="hover:text-gray-900">For every role</a>
            <a href="#security" className="hover:text-gray-900">Security</a>
            <a href={API_DOCS} target="_blank" rel="noreferrer" className="hover:text-gray-900">API</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/auth/login" className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
              Sign in
            </Link>
            <Link href="/auth/register" className="btn-primary text-sm">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary-100/70 via-white to-white" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-16 sm:px-6 lg:grid-cols-2 lg:px-8 lg:pt-24">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-medical-50 px-3 py-1 text-xs font-semibold text-medical-600 ring-1 ring-medical-100">
              <HeartPulse className="h-3.5 w-3.5" /> Multi-tenant hospital platform
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              Run every desk of your hospital from <span className="bg-gradient-to-r from-primary-600 to-medical-500 bg-clip-text text-transparent">one place</span>.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-600">
              Appointments, EMR, prescriptions, lab, pharmacy, wards and billing — connected in real time, scoped per hospital, and secure by default. Built for 30-bed clinics through 800-bed multi-speciality chains.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/auth/login" className="btn-primary inline-flex items-center gap-2 px-6 py-3 text-base">
                Explore the live demo <ArrowRight className="h-4 w-4" />
              </Link>
              <a href={API_DOCS} target="_blank" rel="noreferrer" className="btn-secondary px-6 py-3 text-base">
                API documentation
              </a>
            </div>
            <p className="mt-4 text-sm text-gray-500">One-click demo logins for all nine roles on the sign-in page.</p>
          </div>

          {/* Product preview */}
          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-primary-200/50 to-medical-200/50 blur-2xl" />
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
              <div className="flex items-center gap-1.5 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                <span className="h-2.5 w-2.5 rounded-full bg-green-300" />
                <span className="ml-3 text-xs text-gray-400">Hospital Admin · Dashboard</span>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-4 gap-3">
                  {[
                    ["Patients today", "128", "text-primary-600"],
                    ["Revenue", "₹2.4L", "text-medical-600"],
                    ["Beds occupied", "86%", "text-amber-600"],
                    ["Doctors on duty", "24", "text-violet-600"],
                  ].map(([l, v, c]) => (
                    <div key={l} className="rounded-xl border border-gray-100 p-3">
                      <p className={`text-lg font-bold ${c}`}>{v}</p>
                      <p className="text-[10px] text-gray-500">{l}</p>
                    </div>
                  ))}
                </div>
                <div className="flex h-28 items-end gap-1.5 rounded-xl border border-gray-100 p-3">
                  {[40, 55, 48, 70, 62, 85, 78, 92, 66, 74, 88, 95].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-primary-500 to-medical-400" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="space-y-2">
                  {[
                    ["Ananya Rao", "09:30 · Cardiology", "CONFIRMED", "bg-blue-50 text-blue-700"],
                    ["Vikram Shah", "10:00 · Orthopedics", "IN PROGRESS", "bg-violet-50 text-violet-700"],
                    ["Meera Iyer", "10:30 · Pediatrics", "COMPLETED", "bg-green-50 text-green-700"],
                  ].map(([n, t, s, c]) => (
                    <div key={n} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{n}</p>
                        <p className="text-[11px] text-gray-500">{t}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c}`}>{s}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="border-y border-gray-100 bg-gray-50/60">
          <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 text-center sm:px-6 md:grid-cols-4 lg:px-8">
            {[
              ["9", "role-specific workspaces"],
              ["80+", "documented REST endpoints"],
              ["30", "normalised data models"],
              ["74%", "backend test coverage"],
            ].map(([v, l]) => (
              <div key={l}>
                <p className="text-3xl font-bold text-gray-900">{v}</p>
                <p className="text-sm text-gray-500">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Clinical + operational</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Everything a patient visit touches</h2>
          <p className="mt-3 text-gray-600">No more separate tools for the front desk, the lab and the pharmacy. Each department sees the same record, in real time.</p>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary-600 transition-colors group-hover:bg-primary-600 group-hover:text-white">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Workflow */}
      <section className="bg-gradient-to-br from-primary-700 to-medical-600 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold sm:text-4xl">One visit, end to end</h2>
          <p className="mt-3 max-w-2xl text-primary-100">Every step updates the same chart and the same invoice — and notifies the next person in line.</p>
          <ol className="mt-12 grid gap-6 md:grid-cols-5">
            {[
              [CalendarCheck, "Book", "Patient or reception picks a free slot"],
              [HeartPulse, "Triage", "Nurse records vitals; BMI is calculated"],
              [ClipboardList, "Consult", "Doctor writes the encounter and prescribes"],
              [FlaskConical, "Lab & pharmacy", "Tests are processed; medicines dispensed"],
              [CreditCard, "Pay", "One invoice, paid online or at the counter"],
            ].map(([Icon, t, d]: any, i) => (
              <li key={t} className="relative rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
                <span className="text-xs font-semibold text-primary-200">Step {i + 1}</span>
                <Icon className="mt-3 h-6 w-6" />
                <p className="mt-3 font-semibold">{t}</p>
                <p className="mt-1 text-sm text-primary-100">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">Role-aware by design</p>
            <h2 className="mt-2 text-3xl font-bold sm:text-4xl">A workspace for each of the nine roles</h2>
            <p className="mt-3 text-gray-600">Permissions are enforced on every API call, not just hidden in the UI — a pharmacist simply cannot open a diagnosis.</p>
            <Link href="/auth/login" className="mt-6 inline-flex items-center gap-2 font-medium text-primary-600 hover:text-primary-700">
              Try any role in the demo <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {ROLES.map((r) => (
              <div key={r.role} className="flex gap-3 rounded-xl border border-gray-200 p-4">
                <Users className="mt-0.5 h-5 w-5 shrink-0 text-medical-500" />
                <div>
                  <p className="font-semibold">{r.role}</p>
                  <p className="text-sm text-gray-600">{r.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="bg-gray-50 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
          <div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-900 text-white">
              <FileLock2 className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-3xl font-bold sm:text-4xl">Medical data deserves more than a login screen</h2>
            <p className="mt-3 text-gray-600">MedCore follows HIPAA-style controls throughout: tenant isolation, encryption at rest, least-privilege roles and a tamper-evident trail of who changed what.</p>
          </div>
          <ul className="grid gap-3">
            {SECURITY.map((s) => (
              <li key={s} className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-medical-500" />
                <span className="text-sm text-gray-700">{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-3xl bg-gray-900 px-8 py-12 text-white md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">See it with real workflows</h2>
            <p className="mt-2 text-gray-300">Two hospitals, eight doctors, thirty patients and two weeks of visits — ready to explore.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/auth/login" className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-medium text-gray-900 hover:bg-gray-100">
              Open the demo <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/auth/register" className="inline-flex items-center gap-2 rounded-lg px-5 py-3 font-medium text-white ring-1 ring-white/30 hover:bg-white/10">
              <CheckCircle2 className="h-4 w-4" /> Register as a patient
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-100">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-gray-500 sm:flex-row sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary-600" /> MedCore HMS · demo environment with fictional data
          </div>
          <div className="flex gap-5">
            <a href={API_DOCS} target="_blank" rel="noreferrer" className="hover:text-gray-900">API docs</a>
            <a href="https://github.com/LuckyLuck786/hospital_management_system" target="_blank" rel="noreferrer" className="hover:text-gray-900">GitHub</a>
            <Link href="/auth/login" className="hover:text-gray-900">Sign in</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
