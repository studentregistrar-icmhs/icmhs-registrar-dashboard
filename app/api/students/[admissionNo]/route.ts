import { NextResponse } from "next/server";
import { getStudentTimeline } from "@/lib/studentTimeline";

export async function GET(
  req: Request,
  { params }: { params: { admissionNo: string } }
) {
  const profile = await getStudentTimeline(params.admissionNo);
  if (!profile) return NextResponse.json({ error: "Student not found" }, { status: 404 });
  return NextResponse.json(profile);
}
