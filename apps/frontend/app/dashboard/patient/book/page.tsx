"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Stethoscope,
  ChevronLeft,
  CheckCircle,
  AlertCircle,
} from "lucide-react";

export default function BookAppointmentPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState(1);
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedDoctor, setSelectedDoctor] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const res = await api.get("/departments");
      return res.data.data;
    },
  });

  const { data: doctors } = useQuery({
    queryKey: ["doctors", selectedDept],
    queryFn: async () => {
      const res = await api.get(`/doctors?departmentId=${selectedDept}`);
      return res.data.data;
    },
    enabled: !!selectedDept,
  });

  const { data: availability } = useQuery({
    queryKey: ["availability", selectedDoctor, selectedDate],
    queryFn: async () => {
      const res = await api.get(
        `/doctors/${selectedDoctor}/availability?date=${selectedDate}`,
      );
      return res.data.data;
    },
    enabled: !!selectedDoctor && !!selectedDate,
  });

  const bookMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await api.post("/appointments", data);
      return res.data.data;
    },
    onSuccess: () => setStep(4),
    onError: (err: any) => {
      setError(err.response?.data?.error?.message || "Booking failed");
    },
  });

  const handleBook = () => {
    setError("");
    bookMutation.mutate({
      doctorId: selectedDoctor,
      patientId: user?.id,
      departmentId: selectedDept,
      scheduledDate: selectedDate,
      scheduledTime: selectedTime,
      reason,
    });
  };

  const generateDates = () => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
  };

  return (
    <div className="max-w-3xl mx-auto">
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-2xl font-bold mb-6">Book an Appointment</h1>

      <div className="flex items-center gap-2 mb-8">
        {["Department", "Doctor", "Date & Time", "Confirm"].map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step > i + 1
                  ? "bg-green-500 text-white"
                  : step === i + 1
                    ? "bg-primary-600 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {step > i + 1 ? "✓" : i + 1}
            </div>
            <span
              className={`text-sm ${step === i + 1 ? "font-medium text-gray-900" : "text-gray-500"}`}
            >
              {label}
            </span>
            {i < 3 && <div className="flex-1 h-px bg-gray-200 mx-2" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-4 py-3 rounded-lg text-sm mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {step === 1 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-primary-600" /> Select
            Department
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {departments?.map((dept: any) => (
              <button
                key={dept.id}
                onClick={() => {
                  setSelectedDept(dept.id);
                  setStep(2);
                }}
                className="p-4 rounded-lg border-2 border-gray-200 hover:border-primary-300 text-left"
              >
                <p className="font-medium">{dept.name}</p>
                <p className="text-sm text-gray-500">
                  {dept._count?.doctors || 0} doctors
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Select Doctor</h2>
          <div className="space-y-3">
            {doctors?.map((doc: any) => (
              <button
                key={doc.id}
                onClick={() => {
                  setSelectedDoctor(doc.id);
                  setStep(3);
                }}
                className="w-full flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-primary-300 text-left"
              >
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-bold">
                  {doc.user.firstName[0]}
                </div>
                <div className="flex-1">
                  <p className="font-medium">
                    {doc.user.firstName} {doc.user.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{doc.specialization}</p>
                  <p className="text-sm text-primary-600 font-medium">
                    ₹{doc.consultationFee} per visit
                  </p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setStep(1)}
            className="mt-4 text-sm text-primary-600"
          >
            ← Change Department
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="card space-y-6">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary-600" /> Select Date &
            Time
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Date
            </label>
            <div className="grid grid-cols-7 gap-2">
              {generateDates().map((date) => {
                const d = new Date(date);
                return (
                  <button
                    key={date}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedTime("");
                    }}
                    className={`p-2 rounded-lg text-center ${selectedDate === date ? "bg-primary-600 text-white" : "bg-gray-50"}`}
                  >
                    <p className="text-xs">
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </p>
                    <p className="font-bold">{d.getDate()}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {availability?.slots?.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Available Slots
              </label>
              <div className="grid grid-cols-4 gap-2">
                {availability.slots.map((slot: any) => (
                  <button
                    key={slot.time}
                    onClick={() => setSelectedTime(slot.time)}
                    className={`p-2 rounded-lg text-sm text-center ${selectedTime === slot.time ? "bg-primary-600 text-white" : "bg-gray-50"}`}
                  >
                    <Clock className="w-3 h-3 mx-auto mb-1" /> {slot.time}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Reason for Visit
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="input-field"
              rows={3}
              placeholder="Brief description..."
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="btn-secondary">
              ← Back
            </button>
            <button
              onClick={handleBook}
              disabled={!selectedTime || bookMutation.isPending}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {bookMutation.isPending ? "Booking..." : "Confirm Booking"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Appointment Booked!</h2>
          <p className="text-gray-500 mb-6">
            Your appointment has been scheduled successfully.
          </p>
          <button
            onClick={() => router.push("/dashboard/patient")}
            className="btn-primary"
          >
            Go to Dashboard
          </button>
        </div>
      )}
    </div>
  );
}
