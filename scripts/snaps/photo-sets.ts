// Snaps PoC: named photo sets for scripts/snaps/score.ts, so scores stay
// comparable as photos are added to snap-poc/. A set is a fixed list, or a
// name pattern for a batch whose file names carry odd characters (macOS
// screenshots put a narrow no-break space, U+202F, before "am"/"pm").

export interface PhotoSet {
  name: string;
  description: string;
  includes: (image: string) => boolean;
}

const SET1 = new Set([
  "PXL_20260927_142233229.jpg",
  "Screenshot_20261015-111138~2.jpg",
  "Screenshot_20261015-111159~2.jpg",
  "Screenshot_20261015-111412~2.jpg",
  "Screenshot_20261015-111614~2.jpg",
  "Screenshot_20261015-111655~2.jpg",
  "Screenshot_20261015-111748.png",
  "Screenshot_20261015-111831~2.jpg",
  "Screenshot_20261015-111901~2.jpg",
  "Screenshot_20261015-111935.png",
]);

export const PHOTO_SETS: PhotoSet[] = [
  {
    name: "set1",
    description: "the 10 original photos (truth entered 2026-10-15)",
    includes: (image) => SET1.has(image),
  },
  {
    name: "set2",
    description: "the 19 screenshots of 2026-10-16",
    includes: (image) => image.startsWith("Screenshot 2026-10-16 at "),
  },
  { name: "all", description: "every photo", includes: () => true },
];
