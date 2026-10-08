import { redirect } from "next/navigation";

export default function PatientRedirect() {
  redirect("/dashboard/patient");
}
