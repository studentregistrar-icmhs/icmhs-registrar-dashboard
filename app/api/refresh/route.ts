import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Hit this from the "Refresh now" button to force an immediate re-pull
// from the Google Sheet instead of waiting for the next scheduled revalidation.
export async function POST() {
  revalidatePath("/api/students");
  revalidatePath("/");
  return NextResponse.json({ ok: true, refreshedAt: new Date().toISOString() });
}
