import { z } from "zod";
import { protectMutation, apiError } from "@/lib/apiSecurity";
import { rateLimit, requestKey } from "@/lib/rateLimit";
import { addFeedFromUrl } from "@/lib/rss";

const FeedSchema = z.object({
  url: z.string().min(4).max(500),
  folderId: z.string().optional().nullable(),
  categoryId: z.string().optional().nullable()
});

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(withProtocol).toString();
}

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const limit = rateLimit(requestKey(request, "add-feed"), {
      limit: 8,
      windowMs: 10 * 60_000
    });
    if (!limit.allowed) {
      return Response.json(
        { error: "Too many feed requests. Please wait and try again." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } }
      );
    }
    const body = FeedSchema.parse(await request.json());
    const result = await addFeedFromUrl(normalizeUrl(body.url), {
      folderId: body.folderId || undefined,
      categoryId: body.categoryId || undefined
    });
    return Response.json({
      feed: result.feed,
      imported: result.imported
    });
  } catch (error) {
    return apiError(error);
  }
}
