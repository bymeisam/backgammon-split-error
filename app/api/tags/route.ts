import { NextResponse } from "next/server";
import { prismaReadOnly } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/tags
//
// Every tag, by name, with how many decisions carry it — the tag editor's
// autocomplete. Read-only client. Under /api/tags, so gated by proxy.ts:
// only the (write-mode) tag editor uses it.
export async function GET() {
  const tags = await prismaReadOnly.tag.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { decisions: true } } },
  });
  return NextResponse.json({
    tags: tags.map((t) => ({ id: t.id, name: t.name, count: t._count.decisions })),
  });
}
