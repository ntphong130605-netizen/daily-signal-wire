import { PrismaClient } from "@prisma/client";
import { logError } from "@/lib/logger";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function isDatabaseConfigured() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function isLocalProductionBuildWithSqliteFallback() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || "";
  return (
    process.env.NODE_ENV === "production" &&
    !process.env.VERCEL &&
    databaseUrl.startsWith("file:")
  );
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn"] : []
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export async function safeDbQuery<T>(
  event: string,
  fallback: T,
  query: () => Promise<T>
) {
  if (!isDatabaseConfigured()) return fallback;
  if (isLocalProductionBuildWithSqliteFallback()) return fallback;

  try {
    return await query();
  } catch (error) {
    logError(event, error);
    return fallback;
  }
}

export function databaseUnavailableResponse() {
  return Response.json(
    {
      error:
        "DATABASE_URL is not configured. Add a production database URL in Vercel Project Settings."
    },
    { status: 503 }
  );
}
