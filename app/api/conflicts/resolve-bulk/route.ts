import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveLegacyConflictsBulk } from "@/lib/writeStatus";

/**
 * Bulk "Resolve all" for a status category. Gated by its own password
 * check — separate from the site-wide Basic Auth in middleware.ts —
 * because this is a destructive, multi-student write that's easy to
 * trigger by accident. Someone already inside the dashboard (e.g. on a
 * shared machine that's still logged in) still has to type the password
 * again before it runs.
 */
export async function POST(req: NextRequest) {
  const { admissionNos, termSlug, password } = (await req.json()) as {
    admissionNos: string[];
    termSlug: string;
    password: string;
  };

  if (!Array.isArray(admissionNos) || admissionNos.length === 0 || !termSlug) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  const expected = process.env.DASHBOARD_PASSWORD;
  if (!expected || password !== expected) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const results = await resolveLegacyConflictsBulk(admissionNos, termSlug);
  const succeeded = results.filter((r) => r.result.ok).map((r) => r.admissionNo);
  const failed = results.filter((r) => !r.result.ok);

  if (succeeded.length > 0) {
    revalidatePath(`/terms/${termSlug}`);
  }

  return NextResponse.json({ ok: failed.length === 0, succeeded, failed });
}
