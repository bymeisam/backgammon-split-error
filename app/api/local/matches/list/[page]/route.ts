import { NextResponse } from "next/server";
import { listMatches } from "@/lib/local-client";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ page: string }> }
) {
  const { page: pageParam } = await params;
  const page = Number(pageParam);

  if (!Number.isInteger(page) || page < 1) {
    return NextResponse.json({ error: "Invalid page." }, { status: 400 });
  }

  const data = await listMatches(page);
  return NextResponse.json(data);
}
