import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { syncInheritedTerminalStatuses } from "@/lib/writeStatus";
import { checkResolvePassword } from "@/lib/resolveAuth";
import { TERMS } from "@/lib/terms";

export async function POST(req: NextRequest) {
  const { password, syncedBy } = (await req.json()) as {
    password?: string;
    syncedBy?: string;
  };

  if (!checkResolvePassword(password)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  const name = (syncedBy || "").trim() || "Unknown";
  const result = await syncInheritedTerminalStatuses(name);

  if (result.ok) {
    const statusLogTerm = TERMS.find((t) => t.source.kind === "live-statuslog");
    if (statusLogTerm) revalidatePath(`/terms/${statusLogTerm.slug}`);
    return NextResponse.json(result);
  }
  return NextResponse.json(result, { status: 400 });
}
