import { redirect } from "next/navigation";

export default function DoctorRedirect() {
  redirect("/dashboard/doctor");
}
