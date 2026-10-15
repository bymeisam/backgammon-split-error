import { NextResponse } from "next/server";
import { requireMemberApi } from "@/lib/app-auth";
import { allowedImage, isSnapPocEnabled, readSnapImage, snapImageContentType } from "@/lib/snapPocFiles";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ name: string }> };

// GET /api/snap-poc/image/[name]
// Dev-only (404 in production): serves one of the Snaps proof-of-concept
// photos in snap-poc/ for app/snap-poc. 404 unless the name is exactly one
// of the files listed in that folder.
//
// The path ends in a file extension, which proxy.ts's main matcher skips;
// proxy.ts lists this route in its matcher separately so Clerk runs and the
// member check below works.
export async function GET(_req: Request, { params }: Params) {
  if (!isSnapPocEnabled()) return new NextResponse("Not Found", { status: 404 });
  const denied = await requireMemberApi();
  if (denied) return denied;
  const image = allowedImage((await params).name);
  if (!image) return new NextResponse("Not Found", { status: 404 });
  return new NextResponse(new Uint8Array(readSnapImage(image)), {
    headers: { "Content-Type": snapImageContentType(image), "Cache-Control": "no-store" },
  });
}
