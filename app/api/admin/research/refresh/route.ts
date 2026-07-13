import { apiError, protectMutation } from "@/lib/apiSecurity";
import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import { runResearchEngine } from "@/lib/research/engine";

export const maxDuration = 180;

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    if (!isDatabaseConfigured()) return databaseUnavailableResponse();
    const limited = rateLimit(requestKey(request, "research-refresh"), {
      limit: 4,
      windowMs: 10 * 60_000
    });
    if (!limited.allowed) {
      return Response.json(
        { error: "Research refresh rate limit reached." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }
    return Response.json(await runResearchEngine());
  } catch (error) {
    return apiError(error);
  }
}
