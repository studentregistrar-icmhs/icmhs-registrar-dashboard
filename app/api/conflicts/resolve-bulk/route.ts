import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveLegacyConflictsBulk } from "@/lib/writeStatus";
import { checkResolvePassword } from "@/lib/resolveAuth";

export async function POST(req: NextRequest) {
  const { admissionNos, termSlug, password, resolvedBy } = (await req.json()) as {
    admissionNos: string[];
    termSlug: string;
    password?: string;
    resolvedBy?: string;
  };

  if (!Array.isArray(admissionNos) || admissionNos.length === 0 || !termSlug) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  if (!checkResolvePassword(password)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const name = (resolvedBy || "").trim() || "Unknown";
  const results = await resolveLegacyConflictsBulk(admissionNos, termSlug, name);
  const succeeded = results.filter((r) => r.result.ok).map((r) => r.admissionNo);
  const failed = results.filter((r) => !r.result.ok);

  if (succeeded.length > 0) {
    revalidatePath(`/terms/${termSlug}`);
  }

  return NextResponse.json({ ok: failed.length === 0, succeeded, failed });
}
