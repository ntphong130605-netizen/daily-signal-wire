import { apiError, protectMutation } from "@/lib/apiSecurity";
import { databaseUnavailableResponse, isDatabaseConfigured } from "@/lib/prisma";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import { ingestGoogleTrendsUS } from "@/lib/trendIngest";

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    if (!isDatabaseConfigured()) return databaseUnavailableResponse();

    const limited = rateLimit(requestKey(request, "refresh-trends"), {
      limit: 8,
      windowMs: 10 * 60_000
    });
    if (!limited.allowed) {
      return Response.json(
        { error: "Trend refresh rate limit reached." },
        { status: 429, headers: { "Retry-After": String(limited.retryAfter) } }
      );
    }

    const result = await ingestGoogleTrendsUS();
    return Response.json({
      ok: true,
      ...result,
      message:
        result.created > 0
          ? `Imported ${result.created} new trend signals.`
          : "No new trend signals found."
    });
  } catch (error) {
    return apiError(error);
  }
}
