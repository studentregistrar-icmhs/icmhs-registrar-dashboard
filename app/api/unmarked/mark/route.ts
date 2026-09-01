import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { markUnmarkedStudent } from "@/lib/writeStatus";
import { checkResolvePassword } from "@/lib/resolveAuth";

export async function POST(req: NextRequest) {
  const { admissionNo, termSlug, status, password, markedBy } = (await req.json()) as {
    admissionNo: string;
    termSlug: string;
    status?: string;
    password?: string;
    markedBy?: string;
  };

  if (!admissionNo || !termSlug || !status) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  if (!checkResolvePassword(password)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const name = (markedBy || "").trim() || "Unknown";
  const result = await markUnmarkedStudent(admissionNo, termSlug, status, name);

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    revalidatePath(`/students/${admissionNo}`);
    return NextResponse.json(result);
  }

  const statusCode = result.reason === "terminal-lock" ? 409 : result.reason === "not-found" ? 404 : 400;
  return NextResponse.json(result, { status: statusCode });
}
