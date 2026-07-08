import { protectMutation, apiError } from "@/lib/apiSecurity";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import { refreshFeed } from "@/lib/rss";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const limit = rateLimit(requestKey(request, "refresh-feed"), {
      limit: 20,
      windowMs: 10 * 60_000
    });
    if (!limit.allowed) {
      return Response.json(
        { error: "Too many refresh requests. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }
    const { id } = await params;
    const result = await refreshFeed(id);
    return Response.json(result);
  } catch (error) {
    return apiError(error);
  }
}
