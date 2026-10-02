// Classifies a thrown error as "this looks like a TLS chain-of-trust
// failure against Oracle's pinned CA" — the exact shape this project hit
// 2026-10-02 when HeatWave rotated its endpoint CA (see lib/prisma.ts's
// comment above ORACLE_CA_PATH for the full incident and the manual re-pin
// procedure). Deliberately a substring classifier over the error's full
// nested text, not a `.code`/`.errno` check: confirmed empirically that a
// TLS chain failure through PrismaClient + the mariadb driver adapter
// surfaces as a generic PrismaClientKnownRequestError (code P2039, message
// "pool timeout") with the real OpenSSL verification failure buried as a
// plain string 4 levels deep (error.meta.driverAdapterError.cause.cause) —
// so Prisma's own `.code` is useless for this, and the only reliable
// signal is the verification-failure text itself, wherever it ends up
// nested.
//
// No Prisma-specific imports here on purpose — this is pure text
// classification, reusable from lib/prisma.ts's extension, app/status's
// ad-hoc client, lib/sync.ts, and the standalone scripts/check-oracle-cert.ts
// (which doesn't touch Prisma at all).
const CERT_FAILURE_SUBSTRINGS = [
  "self-signed certificate",
  "self signed certificate",
  "certificate signature failure",
  "unable to verify the first certificate",
  "unable to get local issuer certificate",
  "unable to get issuer certificate",
  "certificate has expired",
  "depth zero self-signed certificate",
] as const;

// Depth-limited and cycle-safe (a WeakSet of already-visited objects) —
// this walks caller-supplied, not-necessarily-well-formed error objects, so
// it must never itself throw or hang regardless of what shape shows up.
function collectErrorText(error: unknown, depth: number, seen: WeakSet<object>): string {
  if (depth > 5 || error === null || error === undefined) return "";
  if (typeof error === "string") return error;
  if (typeof error === "number" || typeof error === "boolean") return String(error);
  if (typeof error !== "object") return "";
  if (seen.has(error)) return "";
  seen.add(error);

  if (error instanceof Error) {
    // `.cause` is a non-enumerable own property (confirmed directly —
    // Object.values/Object.keys both skip it), so it needs an explicit
    // check alongside Object.values, which otherwise covers any *other* own
    // enumerable property generically — e.g. Prisma's own `.meta` (a plain
    // object attached directly to the error), confirmed empirically this
    // is exactly where the real OpenSSL verification string ends up for a
    // TLS failure through the mariadb driver adapter.
    const cause = (error as { cause?: unknown }).cause;
    try {
      return [
        error.message,
        collectErrorText(cause, depth + 1, seen),
        ...Object.values(error).map((v) => collectErrorText(v, depth + 1, seen)),
      ].join(" ");
    } catch {
      return error.message;
    }
  }

  try {
    return Object.values(error as Record<string, unknown>)
      .map((v) => collectErrorText(v, depth + 1, seen))
      .join(" ");
  } catch {
    return "";
  }
}

export function isCertVerificationError(error: unknown): boolean {
  let text: string;
  try {
    text = collectErrorText(error, 0, new WeakSet()).toLowerCase();
  } catch {
    return false;
  }
  return CERT_FAILURE_SUBSTRINGS.some((s) => text.includes(s));
}

export const ORACLE_CERT_FAILURE_HINT =
  "Oracle TLS certificate verification failed — HeatWave likely rotated its endpoint CA again " +
  "(this has happened before; see lib/prisma.ts's comment above ORACLE_CA_PATH for the exact " +
  "re-pin procedure). This is not a credentials or network problem.";
