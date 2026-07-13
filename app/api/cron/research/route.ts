import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { isResearchCronAuthorized } from "@/lib/research/cronAuth";
import { runResearchEngine } from "@/lib/research/engine";

export const maxDuration = 180;
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  if (!isResearchCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDatabaseConfigured()) return databaseUnavailableResponse();
  const result = await runResearchEngine();
  return Response.json(result);
}

export async function POST(request: Request) {
  return handler(request);
}

export async function GET(request: Request) {
  return handler(request);
}
