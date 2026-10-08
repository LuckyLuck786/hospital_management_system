"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { api } from "@/lib/api";
import {
  Bell,
  CheckCheck,
  Search,
  Users,
  Stethoscope,
  Pill,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { formatDate } from "@/lib/roles";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket";

export function DashboardHeader() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Debounce the search term before hitting the API
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const res = await api.get("/notifications/me?limit=10");
      return res.data;
    },
    refetchInterval: 30000,
  });

  const { data: results, isFetching: searching } = useQuery({
    queryKey: ["global-search", debounced],
    queryFn: async () => (await api.get(`/search?q=${encodeURIComponent(debounced)}`)).data.data,
    enabled: debounced.length >= 2 && user?.role !== "PATIENT",
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      await api.patch("/notifications/read-all");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  // Live notifications over Socket.IO (replaces polling for new events)
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onNew = (n: any) => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      setToast({ title: n.title, message: n.message });
      const t = setTimeout(() => setToast(null), 6000);
      return () => clearTimeout(t);
    };
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, [queryClient]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const notifications = data?.data || [];
  const unread = data?.unreadCount || 0;

  const roleTargets: Record<string, string> = {
    SUPER_ADMIN: "/dashboard/admin",
    HOSPITAL_ADMIN: "/dashboard/admin",
    DOCTOR: "/dashboard/doctor",
    RECEPTIONIST: "/dashboard/receptionist",
    NURSE: "/dashboard/nurse",
    LAB_TECHNICIAN: "/dashboard/lab",
    PHARMACIST: "/dashboard/pharmacy",
    ACCOUNTANT: "/dashboard/accountant",
  };
  const dashboard = roleTargets[user?.role || ""] || "/dashboard/patient";

  const go = useCallback(
    (href: string) => {
      setSearch("");
      setDebounced("");
      setSearchOpen(false);
      router.push(href);
    },
    [router],
  );

  const sections: Array<{ key: string; label: string; icon: any; items: any[]; href: (i: any) => string }> = [
    {
      key: "patients",
      label: "Patients",
      icon: Users,
      items: results?.patients || [],
      href: () => `${dashboard}/patients`,
    },
    {
      key: "doctors",
      label: "Doctors",
      icon: Stethoscope,
      items: results?.doctors || [],
      href: () => `${dashboard}/doctors`,
    },
    {
      key: "medicines",
      label: "Medicines",
      icon: Pill,
      items: results?.medicines || [],
      href: () => (user?.role === "PHARMACIST" ? `${dashboard}` : "#"),
    },
    {
      key: "appointments",
      label: "Appointments",
      icon: CalendarDays,
      items: results?.appointments || [],
      href: () => `${dashboard}/appointments`,
    },
  ];
  const hasAny = sections.some((s) => s.items.length > 0);
  const showSearch = user?.role !== "PATIENT";

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-4">
      <div className="relative max-w-md w-full" ref={searchRef}>
        {showSearch ? (
          <>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              onKeyDown={(e) => {
                if (e.key === "Escape") setSearchOpen(false);
              }}
              placeholder="Search patients, doctors, medicines, appointments..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}

            {searchOpen && debounced.length >= 2 && (
              <div className="absolute left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-50">
                <div className="max-h-96 overflow-y-auto">
                  {isLoading || searching ? (
                    <p className="text-sm text-gray-500 text-center py-6">Searching…</p>
                  ) : !hasAny ? (
                    <p className="text-sm text-gray-500 text-center py-6">No results for &ldquo;{debounced}&rdquo;</p>
                  ) : (
                    sections.map(
                      (sec) =>
                        sec.items.length > 0 && (
                          <div key={sec.key} className="py-1">
                            <p className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                              {sec.label}
                            </p>
                            {sec.items.slice(0, 4).map((item: any, idx: number) => {
                              const Icon = sec.icon;
                              const href = sec.href(item);
                              const inner = (
                                <div className="flex items-center gap-3 w-full text-left">
                                  <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4 text-gray-500" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">
                                      {sec.key === "medicines"
                                        ? item.name
                                        : item.name || `${item.patient} · ${item.appointmentNumber}`}
                                    </p>
                                    <p className="text-xs text-gray-500 truncate">
                                      {sec.key === "patients" && (item.email || item.phone || item.patientId)}
                                      {sec.key === "doctors" && (item.specialization || item.department)}
                                      {sec.key === "medicines" && `${item.genericName} · ₹${item.unitPrice}`}
                                      {sec.key === "appointments" && `${item.patient} · ${formatDate(item.scheduledDate)} ${item.scheduledTime}`}
                                    </p>
                                  </div>
                                </div>
                              );
                              return href === "#" ? (
                                <div key={idx} className="px-4 py-2 hover:bg-gray-50">
                                  {inner}
                                </div>
                              ) : (
                                <Link
                                  key={idx}
                                  href={href}
                                  onClick={() => go(href)}
                                  className="block px-4 py-2 hover:bg-gray-50"
                                >
                                  {inner}
                                </Link>
                              );
                            })}
                          </div>
                        ),
                    )
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400">MedCore HMS</p>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="relative" ref={ref}>
          <button
            onClick={() => setOpen(!open)}
            className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unread > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-96 bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden z-50">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <p className="font-semibold text-sm">Notifications</p>
                {unread > 0 && (
                  <button
                    onClick={() => markAllRead.mutate()}
                    className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {isLoading ? (
                  <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
                ) : notifications.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-8">No notifications yet</p>
                ) : (
                  notifications.map((n: any) => (
                    <div
                      key={n.id}
                      className={cn("px-4 py-3 border-b border-gray-100 hover:bg-gray-50", !n.isRead && "bg-primary-50/50")}
                    >
                      <p className="text-sm font-medium text-gray-900">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        <div className="text-sm text-right hidden sm:block">
          <p className="font-medium text-gray-900">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-gray-500 text-xs">{user?.email}</p>
        </div>
      </div>

      {toast && (
        <div className="fixed top-20 right-6 z-[100] max-w-sm bg-gray-900 text-white rounded-xl shadow-2xl px-4 py-3 animate-in fade-in slide-in-from-top-2">
          <p className="text-sm font-semibold">{toast.title}</p>
          <p className="text-xs text-gray-300 mt-0.5 line-clamp-2">{toast.message}</p>
          <button
            onClick={() => setToast(null)}
            className="absolute top-2 right-2 text-gray-400 hover:text-white text-xs"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}
    </header>
  );
}
