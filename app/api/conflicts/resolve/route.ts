import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveLegacyConflict } from "@/lib/writeStatus";

export async function POST(req: NextRequest) {
  const { admissionNo, termSlug } = (await req.json()) as {
    admissionNo: string;
    termSlug: string;
  };

  if (!admissionNo || !termSlug) {
    return NextResponse.json({ ok: false, reason: "invalid-status" }, { status: 400 });
  }

  const result = await resolveLegacyConflict(admissionNo, termSlug);

  if (result.ok) {
    revalidatePath(`/terms/${termSlug}`);
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}
