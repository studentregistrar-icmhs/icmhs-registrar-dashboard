import { notFound } from "next/navigation";
import { getStudentTimeline } from "@/lib/studentTimeline";
import StudentProfile from "@/components/StudentProfile";

export default async function StudentPage({ params }: { params: { admissionNo: string } }) {
  const profile = await getStudentTimeline(decodeURIComponent(params.admissionNo));
  if (!profile) notFound();
  return <StudentProfile initialProfile={profile} />;
}
