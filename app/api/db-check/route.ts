import { NextResponse } from "next/server";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@/lib/generated/prisma/client";

// Throwaway smoke test for the local MySQL + Prisma infra setup — not a
// feature. Visit /api/db-check with the Docker MySQL container running to
// confirm Prisma can actually reach it. Disabled outside development since it
// only exists to verify this setup step.
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const adapter = new PrismaMariaDb(process.env.DATABASE_URL as string);
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, message: "MySQL connection OK" });
  } catch (error) {
    console.error("MySQL connection FAILED:", error);
    return NextResponse.json(
      { ok: false, message: "MySQL connection FAILED" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
