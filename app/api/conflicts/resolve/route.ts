import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveLegacyConflict } from "@/lib/writeStatus";
import { checkResolvePassword } from "@/lib/resolveAuth";

export async function POST(req: NextRequest) {
  const { admissionNo, termSlug, password, resolvedBy } = (await req.json()) as {
    admissionNo: string;
    termSlug: string;
    password?: string;
    resolvedBy?: string;
  };

  if (!admissionNo || !termSlug) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  if (!checkResolvePassword(password)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const name = (resolvedBy || "").trim() || "Unknown";
  const result = await resolveLegacyConflict(admissionNo, termSlug, name);

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}
