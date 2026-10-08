"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatTime, getStatusColor } from "@/lib/utils";
import Link from "next/link";
import { CalendarDays, Users, UserPlus, CreditCard, Clock } from "lucide-react";

export default function ReceptionistDashboard() {
  const { data: todayAppointments } = useQuery({
    queryKey: ["today-appointments"],
    queryFn: async () => {
      const res = await api.get("/appointments/today");
      return res.data.data;
    },
  });

  const stats = [
    {
      label: "Today's Appointments",
      value: todayAppointments?.length || 0,
      icon: CalendarDays,
      color: "bg-blue-500",
    },
    {
      label: "New Patients",
      value: "5",
      icon: UserPlus,
      color: "bg-green-500",
    },
    {
      label: "Check-ins Pending",
      value: "12",
      icon: Clock,
      color: "bg-yellow-500",
    },
    {
      label: "Pending Payments",
      value: "₹45,200",
      icon: CreditCard,
      color: "bg-orange-500",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reception Desk</h1>
        <p className="text-gray-500">
          Manage appointments, patients, and billing
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="card flex items-center gap-4">
              <div
                className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center`}
              >
                <Icon className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-sm text-gray-500">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Today's Schedule</h2>
          <Link
            href="/dashboard/receptionist/appointments"
            className="text-sm text-primary-600 font-medium"
          >
            View All
          </Link>
        </div>
        <div className="space-y-3">
          {todayAppointments?.map((apt: any) => (
            <div
              key={apt.id}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center gap-4">
                <div className="text-center w-14">
                  <p className="font-bold text-primary-700">
                    {formatTime(apt.scheduledTime)}
                  </p>
                </div>
                <div className="w-px h-10 bg-gray-300" />
                <div>
                  <p className="font-medium">
                    {apt.patient?.user.firstName} {apt.patient?.user.lastName}
                  </p>
                  <p className="text-sm text-gray-500">
                    Dr. {apt.doctor?.user.lastName} • {apt.department?.name}
                  </p>
                </div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apt.status)}`}
              >
                {apt.status}
              </span>
            </div>
          )) || (
            <p className="text-center py-8 text-gray-500">
              No appointments for today
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
