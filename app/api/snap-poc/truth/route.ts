import { NextResponse } from "next/server";
import { requireMemberApi } from "@/lib/app-auth";
import { validateSnapLayout } from "@/lib/snapPocLayout";
import { allowedImage, allowedRun, isSnapOrientation, isSnapPocEnabled, writeSnapTruth } from "@/lib/snapPocFiles";

export const dynamic = "force-dynamic";

// POST /api/snap-poc/truth   body: { image, layout, orientation, model, promptVersion }
// Dev-only (404 in production): saves the user's corrected board for one
// Snaps proof-of-concept photo to snap-poc/truth/<image>.json. A local file,
// not a DB write, so the app write gate (lib/appWriteGate.ts) doesn't apply.
// 404 unless `image` is exactly one of the photos in snap-poc/; 400 unless
// (`model`, `promptVersion`) is one of the results/<model>/<version>/ folders and the layout and orientation are valid.
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
  const run = allowedRun(body.model, body.promptVersion);
  if (!run) return NextResponse.json({ error: "Unknown model or prompt version." }, { status: 400 });
  if (!isSnapOrientation(body.orientation)) {
    return NextResponse.json({ error: "Orientation is invalid." }, { status: 400 });
  }
  const layout = validateSnapLayout(body.layout);
  if (!layout.ok) return NextResponse.json({ error: layout.errors.join("; ") }, { status: 400 });

  const truth = {
    image,
    model: run.model,
    promptVersion: run.version,
    // mirroredNumbers and rotated are written only when on, so a default
    // board saves the same shape as before they existed.
    orientation: {
      bottomColor: body.orientation.bottomColor,
      bottomHome: body.orientation.bottomHome,
      ...(body.orientation.mirroredNumbers ? { mirroredNumbers: true } : {}),
      ...(body.orientation.rotated ? { rotated: true } : {}),
    },
    layout: layout.layout,
    savedAt: new Date().toISOString(),
  };
  writeSnapTruth(truth);
  return NextResponse.json(truth);
}
