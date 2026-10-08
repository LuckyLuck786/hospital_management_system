"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { roleLabel } from "@/lib/roles";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Stethoscope,
  FileText,
  Pill,
  FlaskConical,
  CreditCard,
  Settings,
  LogOut,
  Building2,
  UserCircle,
  Activity,
  ClipboardList,
} from "lucide-react";

const navItems: Record<string, Array<{ label: string; href: string; icon: any }>> = {
  SUPER_ADMIN: [
    { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Hospitals", href: "/dashboard/admin/hospitals", icon: Building2 },
    { label: "Users", href: "/dashboard/admin/users", icon: Users },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
  ],
  HOSPITAL_ADMIN: [
    { label: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
    { label: "Departments", href: "/dashboard/admin/departments", icon: Building2 },
    { label: "Doctors", href: "/dashboard/admin/doctors", icon: Stethoscope },
    { label: "Users", href: "/dashboard/admin/users", icon: Users },
    { label: "Settings", href: "/dashboard/admin/settings", icon: Settings },
  ],
  DOCTOR: [
    { label: "Dashboard", href: "/dashboard/doctor", icon: LayoutDashboard },
    { label: "Appointments", href: "/dashboard/doctor/appointments", icon: CalendarDays },
    { label: "Patients", href: "/dashboard/doctor/patients", icon: Users },
    { label: "Prescriptions", href: "/dashboard/doctor/prescriptions", icon: Pill },
    { label: "Lab Reports", href: "/dashboard/doctor/lab-reports", icon: FlaskConical },
  ],
  NURSE: [
    { label: "Dashboard", href: "/dashboard/nurse", icon: LayoutDashboard },
    { label: "Appointments", href: "/dashboard/doctor/appointments", icon: CalendarDays },
    { label: "Patients", href: "/dashboard/doctor/patients", icon: Users },
    { label: "Records", href: "/dashboard/doctor/prescriptions", icon: ClipboardList },
  ],
  RECEPTIONIST: [
    { label: "Dashboard", href: "/dashboard/receptionist", icon: LayoutDashboard },
    { label: "Appointments", href: "/dashboard/receptionist/appointments", icon: CalendarDays },
    { label: "Patients", href: "/dashboard/receptionist/patients", icon: Users },
    { label: "Billing", href: "/dashboard/receptionist/billing", icon: CreditCard },
  ],
  LAB_TECHNICIAN: [
    { label: "Dashboard", href: "/dashboard/lab", icon: LayoutDashboard },
    { label: "Patients", href: "/dashboard/doctor/patients", icon: Users },
    { label: "Records", href: "/dashboard/doctor/prescriptions", icon: FlaskConical },
  ],
  PHARMACIST: [
    { label: "Dashboard", href: "/dashboard/pharmacy", icon: LayoutDashboard },
    { label: "Inventory", href: "/dashboard/pharmacy", icon: Pill },
    { label: "Patients", href: "/dashboard/doctor/patients", icon: Users },
  ],
  ACCOUNTANT: [
    { label: "Dashboard", href: "/dashboard/accountant", icon: LayoutDashboard },
    { label: "Billing", href: "/dashboard/receptionist/billing", icon: CreditCard },
    { label: "Patients", href: "/dashboard/doctor/patients", icon: Users },
  ],
  PATIENT: [
    { label: "Dashboard", href: "/dashboard/patient", icon: LayoutDashboard },
    { label: "Book Appointment", href: "/dashboard/patient/book", icon: CalendarDays },
    { label: "My Records", href: "/dashboard/patient/records", icon: FileText },
    { label: "Lab Reports", href: "/dashboard/patient/lab-reports", icon: FlaskConical },
    { label: "Prescriptions", href: "/dashboard/patient/prescriptions", icon: Pill },
    { label: "My Bills", href: "/dashboard/patient/bills", icon: CreditCard },
  ],
};

export function DashboardSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const role = user?.role || "PATIENT";
  const items = navItems[role] || navItems.PATIENT;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${localStorage.getItem("accessToken")}` } });
    } catch {
      // ignore network errors on logout
    }
    logout();
    router.push("/login");
  };

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-50">
      <div className="p-4 border-b border-gray-200">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-lg font-bold text-primary-900">MedCore</span>
          <span className="text-[10px] uppercase tracking-wider text-gray-400 ml-auto">HMS</span>
        </Link>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary-50 text-primary-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200 space-y-3">
        <div className="flex items-center gap-3 px-3">
          <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
            <UserCircle className="w-5 h-5 text-primary-600" />
          </div>
          <div className="overflow-hidden">
            <p className="text-sm font-medium truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-gray-500 truncate">{roleLabel(role)}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2 w-full text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
