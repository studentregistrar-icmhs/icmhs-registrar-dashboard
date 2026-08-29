import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { loadTermData } from "@/lib/loadTermData";

export async function GET(req: NextRequest, { params }: { params: { term: string } }) {
  const data = await loadTermData(params.term);
  if (!data) return NextResponse.json({ error: "Unknown term" }, { status: 404 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest, { params }: { params: { term: string } }) {
  revalidatePath(`/terms/${params.term}`);
  const data = await loadTermData(params.term);
  return NextResponse.json({ ok: true, ...data });
}
