import { prisma } from "@contractor-ops/db";
import { NextResponse } from "next/server";

/**
 * Health check endpoint for load balancers and uptime monitors.
 * Verifies database connectivity with a lightweight query.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json(
      { status: "ok", timestamp: new Date().toISOString() },
      { status: 200 },
    );
  } catch {
    return NextResponse.json(
      { status: "error", message: "Database connection failed" },
      { status: 503 },
    );
  }
}
