import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveLegacyConflictsBulk } from "@/lib/writeStatus";

export async function POST(req: NextRequest) {
  const { admissionNos, termSlug } = (await req.json()) as {
    admissionNos: string[];
    termSlug: string;
  };

  if (!Array.isArray(admissionNos) || admissionNos.length === 0 || !termSlug) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  const results = await resolveLegacyConflictsBulk(admissionNos, termSlug);
  const succeeded = results.filter((r) => r.result.ok).map((r) => r.admissionNo);
  const failed = results.filter((r) => !r.result.ok);

  if (succeeded.length > 0) {
    revalidatePath(`/terms/${termSlug}`);
  }

  return NextResponse.json({ ok: failed.length === 0, succeeded, failed });
}
