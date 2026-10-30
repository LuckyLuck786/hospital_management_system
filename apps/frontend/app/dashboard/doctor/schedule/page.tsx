"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, LoadingState } from "@/components/shared/states";
import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, Loader2, Plus, Trash2 } from "lucide-react";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type Window = { start: string; end: string; slotDuration: number };
type Schedule = Record<string, Window[]>;

function slotsIn(w: Window) {
  const [sh, sm] = w.start.split(":").map(Number);
  const [eh, em] = w.end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? Math.floor(mins / w.slotDuration) : 0;
}

export default function DoctorSchedulePage() {
  const qc = useQueryClient();
  const [schedule, setSchedule] = useState<Schedule>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const { data: me, isLoading, isError, refetch } = useQuery({
    queryKey: ["me"],
    queryFn: async () => (await api.get("/users/me")).data.data,
  });
  const doctorId = me?.doctor?.id;

  const { data: doctor } = useQuery({
    queryKey: ["doctor", doctorId],
    queryFn: async () => (await api.get(`/doctors/${doctorId}`)).data.data,
    enabled: !!doctorId,
  });

  useEffect(() => {
    if (doctor) setSchedule((doctor.weeklySchedule as Schedule) || {});
  }, [doctor]);

  const save = useMutation({
    mutationFn: async () => (await api.patch(`/doctors/${doctorId}/schedule`, schedule)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["doctor", doctorId] });
      setError("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
    onError: (e: any) => setError(e.response?.data?.error?.message || "Could not save schedule"),
  });

  const update = (day: string, i: number, patch: Partial<Window>) =>
    setSchedule((s) => ({ ...s, [day]: (s[day] || []).map((w, j) => (j === i ? { ...w, ...patch } : w)) }));
  const add = (day: string) =>
    setSchedule((s) => ({ ...s, [day]: [...(s[day] || []), { start: "09:00", end: "13:00", slotDuration: 30 }] }));
  const remove = (day: string, i: number) => setSchedule((s) => ({ ...s, [day]: (s[day] || []).filter((_, j) => j !== i) }));

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState message="Could not load your profile." onRetry={() => refetch()} />;
  if (!doctorId) return <ErrorState message="No doctor profile is linked to this account." />;

  const weeklySlots = DAYS.reduce((sum, d) => sum + (schedule[d] || []).reduce((s, w) => s + slotsIn(w), 0), 0);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="My Schedule"
        description="Your repeating weekly availability. Patients and reception book from these slots; existing bookings are never moved."
        actions={
          <button className="btn-primary inline-flex items-center gap-2" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <CheckCircle2 className="h-4 w-4" /> : null}
            {saved ? "Saved" : "Save schedule"}
          </button>
        }
      />
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex items-center gap-2 rounded-xl bg-primary-50 px-4 py-3 text-sm text-primary-800">
        <Clock className="h-4 w-4" /> {weeklySlots} bookable slots per week
      </div>

      <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {DAYS.map((day) => {
          const windows = schedule[day] || [];
          return (
            <div key={day} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
              <div className="w-32 shrink-0 pt-2">
                <p className="font-medium capitalize text-gray-900">{day}</p>
                <p className={cn("text-xs", windows.length ? "text-medical-600" : "text-gray-400")}>
                  {windows.length ? `${windows.reduce((s, w) => s + slotsIn(w), 0)} slots` : "Off"}
                </p>
              </div>
              <div className="flex-1 space-y-2">
                {windows.map((w, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input type="time" className="input-field w-32" value={w.start} onChange={(e) => update(day, i, { start: e.target.value })} aria-label={`${day} start`} />
                    <span className="text-gray-400">to</span>
                    <input type="time" className="input-field w-32" value={w.end} onChange={(e) => update(day, i, { end: e.target.value })} aria-label={`${day} end`} />
                    <select className="input-field w-32" value={w.slotDuration} onChange={(e) => update(day, i, { slotDuration: Number(e.target.value) })} aria-label="Slot length">
                      {[10, 15, 20, 30, 45, 60].map((m) => (
                        <option key={m} value={m}>
                          {m} min slots
                        </option>
                      ))}
                    </select>
                    <button className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" onClick={() => remove(day, i)} aria-label="Remove window">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-primary-600 hover:bg-primary-50" onClick={() => add(day)}>
                  <Plus className="h-4 w-4" /> Add hours
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
