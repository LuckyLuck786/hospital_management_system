"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatTime } from "@/lib/roles";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

const ACTIVE = ["PENDING", "CONFIRMED", "IN_PROGRESS", "EMERGENCY"];

/** Mini month view of the signed-in doctor's upcoming appointments (PRD §9 doctor dashboard). */
export function FollowUpCalendar() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["doctor-calendar"],
    queryFn: async () => (await api.get("/appointments?limit=200")).data.data as any[],
  });

  const byDay = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of data || []) {
      if (!ACTIVE.includes(a.status)) continue;
      const key = String(a.scheduledDate).slice(0, 10);
      map.set(key, [...(map.get(key) || []), a]);
    }
    for (const list of map.values()) list.sort((x, y) => x.scheduledTime.localeCompare(y.scheduledTime));
    return map;
  }, [data]);

  const todayKey = new Date().toISOString().slice(0, 10);
  const first = month.getDay(); // 0 = Sunday
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: first + daysInMonth }, (_, i) => (i < first ? null : i - first + 1));
  const keyFor = (day: number) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const selectedList = selected ? byDay.get(selected) || [] : [];

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <CalendarDays className="h-5 w-5 text-primary-600" /> Upcoming follow-ups
        </h2>
        <div className="flex items-center gap-1">
          <button className="rounded-md p-1 text-gray-500 hover:bg-gray-100" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="w-28 text-center text-sm font-medium">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</span>
          <button className="rounded-md p-1 text-gray-500 hover:bg-gray-100" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const key = keyFor(day);
          const count = byDay.get(key)?.length || 0;
          const isToday = key === todayKey;
          const isPast = key < todayKey;
          return (
            <button
              key={i}
              onClick={() => setSelected(selected === key ? null : key)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors",
                selected === key ? "bg-primary-600 text-white" : isToday ? "bg-primary-50 font-semibold text-primary-700" : "hover:bg-gray-50",
                isPast && selected !== key && "text-gray-300",
              )}
            >
              {day}
              {count > 0 && (
                <span className={cn("mt-0.5 rounded-full px-1.5 text-[9px] font-semibold leading-4", selected === key ? "bg-white/25 text-white" : "bg-medical-100 text-medical-600")}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {selected && (
        <div className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
          {selectedList.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing booked on this day.</p>
          ) : (
            selectedList.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {a.patient?.user?.firstName} {a.patient?.user?.lastName}
                  <span className="ml-1 text-xs text-gray-400">{a.reason}</span>
                </span>
                <span className="shrink-0 font-medium tabular-nums text-primary-700">{formatTime(a.scheduledTime)}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
