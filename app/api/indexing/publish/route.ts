import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { batchPublish, publishUrl } from "@/lib/googleIndexing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SubmitSchema = z
  .object({
    url: z.string().url().optional(),
    urls: z.array(z.string().url()).max(100).optional()
  })
  .refine((value) => Boolean(value.url || value.urls?.length), {
    message: "url or urls is required."
  });

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = SubmitSchema.parse(await request.json().catch(() => ({})));
    const result = body.urls?.length
      ? await batchPublish(body.urls)
      : [await publishUrl(body.url || "")];
    return Response.json({ ok: true, jobs: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid indexing request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
