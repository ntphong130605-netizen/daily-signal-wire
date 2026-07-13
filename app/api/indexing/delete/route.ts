import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { deleteUrl } from "@/lib/googleIndexing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DeleteSchema = z
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
    const body = DeleteSchema.parse(await request.json().catch(() => ({})));
    const urls = body.urls?.length ? body.urls : [body.url || ""];
    const jobs = [];
    for (const url of urls) {
      jobs.push(await deleteUrl(url));
    }
    return Response.json({ ok: true, jobs });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid indexing delete request." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
