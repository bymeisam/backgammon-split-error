import { NextResponse } from "next/server";
import { requireMemberApi } from "@/lib/app-auth";
import { validateSnapLayout } from "@/lib/snapPocLayout";
import { allowedImage, allowedModel, isSnapOrientation, isSnapPocEnabled, writeSnapTruth } from "@/lib/snapPocFiles";

export const dynamic = "force-dynamic";

// POST /api/snap-poc/truth   body: { image, layout, orientation, model }
// Dev-only (404 in production): saves the user's corrected board for one
// Snaps proof-of-concept photo to snap-poc/truth/<image>.json. A local file,
// not a DB write, so the app write gate (lib/appWriteGate.ts) doesn't apply.
// 404 unless `image` is exactly one of the photos in snap-poc/; 400 unless
// `model` is one of the result folders and the layout and orientation are valid.
export async function POST(req: Request) {
  if (!isSnapPocEnabled()) return new NextResponse("Not Found", { status: 404 });
  const denied = await requireMemberApi();
  if (denied) return denied;

  let body: Record<string, unknown> | null = null;
  try {
    const json: unknown = await req.json();
    if (typeof json === "object" && json !== null && !Array.isArray(json)) body = json as Record<string, unknown>;
  } catch {
    body = null;
  }
  if (!body) return NextResponse.json({ error: "Body must be a JSON object." }, { status: 400 });

  const image = allowedImage(body.image);
  if (!image) return new NextResponse("Not Found", { status: 404 });
  const model = allowedModel(body.model);
  if (!model) return NextResponse.json({ error: "Unknown model." }, { status: 400 });
  if (!isSnapOrientation(body.orientation)) {
    return NextResponse.json({ error: "Orientation is invalid." }, { status: 400 });
  }
  const layout = validateSnapLayout(body.layout);
  if (!layout.ok) return NextResponse.json({ error: layout.errors.join("; ") }, { status: 400 });

  const truth = {
    image,
    model,
    // mirroredNumbers is written only when on, so a default board saves the
    // same shape as before it existed.
    orientation: {
      bottomColor: body.orientation.bottomColor,
      bottomHome: body.orientation.bottomHome,
      ...(body.orientation.mirroredNumbers ? { mirroredNumbers: true } : {}),
    },
    layout: layout.layout,
    savedAt: new Date().toISOString(),
  };
  writeSnapTruth(truth);
  return NextResponse.json(truth);
}
