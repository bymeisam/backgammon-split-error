// Scheduled/on-demand health check (see .github/workflows/check-oracle-cert.yml):
// catches an Oracle HeatWave CA rotation (the failure this project hit
// 2026-10-02 — see lib/prisma.ts's comment above ORACLE_CA_PATH) *before*
// it breaks a real sync/deploy, not after.
//
// Deliberately credential-free: attempts a real TLS-verified connection
// (via the `mariadb` package, through the same buildConnectionConfig
// helper lib/prisma.ts itself uses — not reimplemented) to the real Oracle
// host, using the real pinned CA from certs/oracle-mysql-ca.pem but a
// made-up username/password. Confirmed empirically this session: the TLS
// handshake (cert exchange + verification) completes, or fails, entirely
// before MySQL's own authentication is ever attempted — so a fake user is
// enough to test "is the pinned CA still valid," no real Oracle
// credentials need to exist in CI at all.
//
// Host comes from ORACLE_DB_HOST (not hardcoded — the real IP has never
// been committed to this repo; see .env's own comment). Locally this is
// already set in .env; in CI it's a repository secret of the same name.
//
// Usage:
//   npx tsx scripts/check-oracle-cert.ts
import "dotenv/config";
import mariadb from "mariadb";
import { buildConnectionConfig } from "@/lib/prisma";
import { isCertVerificationError, ORACLE_CERT_FAILURE_HINT } from "@/lib/oracleCertCheck";

async function main() {
  const host = process.env.ORACLE_DB_HOST;
  if (!host) {
    console.error("ORACLE_DB_HOST is not set — see .env's own comment for the real value.");
    process.exitCode = 1;
    return;
  }

  const url = `mysql://cert-check-canary:not-a-real-password@${host}:3306/backgammon?ssl=true&allowPublicKeyRetrieval=true`;
  const config = buildConnectionConfig(url);

  try {
    const conn = await mariadb.createConnection({ ...config, connectTimeout: 10_000 });
    // Shouldn't happen (the user/password are made up), but if Oracle ever
    // allows this, TLS obviously succeeded too — nothing to warn about.
    console.log("Connected unexpectedly (TLS verification succeeded) — pinned CA is fine.");
    await conn.end();
    return;
  } catch (error) {
    if (isCertVerificationError(error)) {
      console.error(`FAIL: ${ORACLE_CERT_FAILURE_HINT}`);
      console.error(`Raw error: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
      return;
    }

    const code = (error as { code?: string } | null)?.code;
    if (code === "ER_ACCESS_DENIED_ERROR") {
      // Exactly the expected outcome: TLS handshake + verification against
      // the pinned CA succeeded, and only the (deliberately fake) MySQL
      // credentials were rejected afterward.
      console.log("OK: TLS verification against the pinned CA succeeded (got the expected auth rejection).");
      return;
    }

    // Anything else (host unreachable, DNS failure, etc.) is a real problem
    // too, just not a cert rotation — flagged distinctly so it's not
    // confused with one.
    console.error(
      `FAIL: connection failed for a reason other than cert verification or the expected auth rejection (code: ${code ?? "unknown"}).`
    );
    console.error(`Raw error: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

main();
