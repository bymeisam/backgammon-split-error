import { describe, expect, it } from "vitest";
import { isCertVerificationError } from "@/lib/oracleCertCheck";

// Mirrors the exact shape captured empirically this session (2026-10-02) by
// triggering a real TLS chain-of-trust failure through PrismaClient +
// @prisma/adapter-mariadb: a generic PrismaClientKnownRequestError (code
// P2039, "pool timeout") with the real OpenSSL verification string buried
// 4 levels deep at error.meta.driverAdapterError.cause.cause.
function realPrismaCertFailure(): Error {
  const error = new Error(
    'Invalid `prisma.match.count()` invocation:\n\n\nDatabase error. Code: `45028`. Message: `pool timeout: failed to retrieve a connection from pool after 10001ms\n    (pool connections: active=0 idle=0 limit=1)`'
  );
  (error as unknown as { code: string }).code = "P2039";
  (error as unknown as { meta: object }).meta = {
    modelName: "Match",
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        originalCode: "45028",
        originalMessage:
          "pool timeout: failed to retrieve a connection from pool after 10001ms\n    (pool connections: active=0 idle=0 limit=1)",
        kind: "mysql",
        code: 45028,
        message: "pool timeout: failed to retrieve a connection from pool after 10001ms",
        state: "HY000",
        cause: "self-signed certificate in certificate chain",
      },
    },
  };
  return error;
}

describe("isCertVerificationError", () => {
  it("recognizes the real nested Prisma/mariadb-adapter shape captured for an actual CA rotation", () => {
    expect(isCertVerificationError(realPrismaCertFailure())).toBe(true);
  });

  it("recognizes a plain top-level message match", () => {
    expect(isCertVerificationError(new Error("certificate signature failure"))).toBe(true);
  });

  it("recognizes a message nested via Error.cause", () => {
    const inner = new Error("unable to get local issuer certificate");
    const outer = new Error("connection failed", { cause: inner });
    expect(isCertVerificationError(outer)).toBe(true);
  });

  it("returns false for an unrelated auth error", () => {
    const error = new Error("Access denied for user 'cert-check-canary'@'%' (using password: YES)");
    (error as unknown as { code: string }).code = "ER_ACCESS_DENIED_ERROR";
    expect(isCertVerificationError(error)).toBe(false);
  });

  it("returns false for an unrelated network error", () => {
    const error = new Error("connect ETIMEDOUT 161.33.73.223:3306");
    (error as unknown as { code: string }).code = "ETIMEDOUT";
    expect(isCertVerificationError(error)).toBe(false);
  });

  it("returns false for null/undefined/plain values without throwing", () => {
    expect(isCertVerificationError(null)).toBe(false);
    expect(isCertVerificationError(undefined)).toBe(false);
    expect(isCertVerificationError("just a string")).toBe(false);
    expect(isCertVerificationError(42)).toBe(false);
  });

  it("never throws on a circular error object", () => {
    const circular: Record<string, unknown> = { message: "self-signed certificate in chain" };
    circular.self = circular;
    expect(() => isCertVerificationError(circular)).not.toThrow();
    expect(isCertVerificationError(circular)).toBe(true);
  });
});
