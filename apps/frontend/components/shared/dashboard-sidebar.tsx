"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { useUiStore } from "@/store/ui-store";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";
import {
  LayoutDashboard,
  CalendarDays,
  CalendarClock,
  Users,
  Stethoscope,
  FileText,
  Pill,
  FlaskConical,
  CreditCard,
  Settings,
  LogOut,
  Building2,
  Activity,
  ClipboardList,
  BedDouble,
  ShieldCheck,
  Boxes,
  HeartPulse,
  X,
} from "lucide-react";

type NavItem = { label: string; href: string; icon: any };
type NavGroup = { title?: string; items: NavItem[] };

const SETTINGS: NavItem = { label: "Settings", href: "/dashboard/settings", icon: Settings };

const navGroups: Record<string, NavGroup[]> = {
  SUPER_ADMIN: [
    { items: [{ label: "Platform Overview", href: "/dashboard/admin", icon: LayoutDashboard }] },
    {
      title: "Platform",
      items: [
        { label: "Hospitals", href: "/dashboard/admin/hospitals", icon: Building2 },
        { label: "Users", href: "/dashboard/admin/users", icon: Users },
        { label: "Audit Log", href: "/dashboard/audit", icon: ShieldCheck },
      ],
    },
    { items: [SETTINGS] },
  ],
  HOSPITAL_ADMIN: [
    { items: [{ label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard }] },
    {
      title: "Hospital",
      items: [
        { label: "Patients", href: "/dashboard/patients", icon: Users },
        { label: "Departments", href: "/dashboard/admin/departments", icon: Building2 },
        { label: "Doctors", href: "/dashboard/admin/doctors", icon: Stethoscope },
        { label: "Wards & Beds", href: "/dashboard/wards", icon: BedDouble },
        { label: "Billing", href: "/dashboard/receptionist/billing", icon: CreditCard },
      ],
    },
    {
      title: "Administration",
      items: [
        { label: "Staff & Users", href: "/dashboard/admin/users", icon: ClipboardList },
        { label: "Audit Log", href: "/dashboard/audit", icon: ShieldCheck },
        SETTINGS,
      ],
    },
  ],
  DOCTOR: [
    { items: [{ label: "Dashboard", href: "/dashboard/doctor", icon: LayoutDashboard }] },
    {
      title: "Clinical",
      items: [
        { label: "Appointments", href: "/dashboard/doctor/appointments", icon: CalendarDays },
        { label: "Patients", href: "/dashboard/patients", icon: Users },
        { label: "Records & Prescriptions", href: "/dashboard/doctor/prescriptions", icon: Pill },
        { label: "Lab Reports", href: "/dashboard/doctor/lab-reports", icon: FlaskConical },
        { label: "Wards & Beds", href: "/dashboard/wards", icon: BedDouble },
      ],
    },
    { items: [{ label: "My Schedule", href: "/dashboard/doctor/schedule", icon: CalendarClock }, SETTINGS] },
  ],
  NURSE: [
    { items: [{ label: "Nurse Station", href: "/dashboard/nurse", icon: LayoutDashboard }] },
    {
      title: "Care",
      items: [
        { label: "Patients & Vitals", href: "/dashboard/patients", icon: HeartPulse },
        { label: "Wards & Beds", href: "/dashboard/wards", icon: BedDouble },
      ],
    },
    { items: [SETTINGS] },
  ],
  RECEPTIONIST: [
    { items: [{ label: "Reception Desk", href: "/dashboard/receptionist", icon: LayoutDashboard }] },
    {
      title: "Front Office",
      items: [
        { label: "Appointments", href: "/dashboard/receptionist/appointments", icon: CalendarDays },
        { label: "Patients", href: "/dashboard/patients", icon: Users },
        { label: "Billing", href: "/dashboard/receptionist/billing", icon: CreditCard },
        { label: "Wards & Beds", href: "/dashboard/wards", icon: BedDouble },
      ],
    },
    { items: [SETTINGS] },
  ],
  LAB_TECHNICIAN: [
    { items: [{ label: "Laboratory", href: "/dashboard/lab", icon: FlaskConical }] },
    { items: [SETTINGS] },
  ],
  PHARMACIST: [
    {
      title: "Pharmacy",
      items: [
        { label: "Dispensing", href: "/dashboard/pharmacy", icon: Pill },
        { label: "Inventory", href: "/dashboard/pharmacy/inventory", icon: Boxes },
      ],
    },
    { items: [SETTINGS] },
  ],
  ACCOUNTANT: [
    { items: [{ label: "Finance", href: "/dashboard/accountant", icon: LayoutDashboard }] },
    { title: "Accounts", items: [{ label: "Invoices & Payments", href: "/dashboard/receptionist/billing", icon: CreditCard }] },
    { items: [SETTINGS] },
  ],
  PATIENT: [
    { items: [{ label: "My Health", href: "/dashboard/patient", icon: LayoutDashboard }] },
    {
      title: "Care",
      items: [
        { label: "Book Appointment", href: "/dashboard/patient/book", icon: CalendarDays },
        { label: "Medical Records", href: "/dashboard/patient/records", icon: FileText },
        { label: "Lab Reports", href: "/dashboard/patient/lab-reports", icon: FlaskConical },
        { label: "Prescriptions", href: "/dashboard/patient/prescriptions", icon: Pill },
      ],
    },
    { title: "Account", items: [{ label: "Bills & Payments", href: "/dashboard/patient/bills", icon: CreditCard }, SETTINGS] },
  ],
};

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { sidebarOpen, setSidebarOpen } = useUiStore();
  const role = user?.role || "PATIENT";
  const groups = navGroups[role] || navGroups.PATIENT;
  const allHrefs = groups.flatMap((g) => g.items.map((i) => i.href));

  // Close the mobile drawer whenever the route changes
  useEffect(() => setSidebarOpen(false), [pathname, setSidebarOpen]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } });
    } catch {
      // ignore network errors on logout
    }
    logout();
    router.push("/auth/login");
  };

  // Highlight the most specific matching link only (e.g. /pharmacy vs /pharmacy/inventory)
  const activeHref = allHrefs
    .filter((h) => pathname === h || pathname.startsWith(h + "/"))
    .sort((a, b) => b.length - a.length)[0];

  const initials = `${user?.firstName?.[0] ?? ""}${user?.lastName?.[0] ?? ""}`.toUpperCase();

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-sm transition-opacity lg:hidden",
          sidebarOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setSidebarOpen(false)}
      />
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 flex h-full w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-gray-200 px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-medical-500 shadow-sm">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <div className="leading-tight">
              <span className="block text-base font-bold text-gray-900">MedCore</span>
              <span className="block text-[10px] font-medium uppercase tracking-wider text-gray-400">Hospital OS</span>
            </div>
          </Link>
          <button
            className="ml-auto rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto p-3">
          {groups.map((group, gi) => (
            <div key={gi}>
              {group.title && (
                <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-gray-400">{group.title}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.href === activeHref;
                  return (
                    <Link
                      key={item.href + item.label}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        isActive ? "bg-primary-50 text-primary-700" : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary-600" : "text-gray-400")} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-gray-200 p-3">
          <div className="flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-100 to-medical-100 text-xs font-semibold text-primary-700">
              {initials || "U"}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-medium text-gray-900">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="truncate text-xs text-gray-500">{roleLabel(role)}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
