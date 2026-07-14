import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import {
  batchDelete,
  batchPublish,
  batchUpdate,
  deleteUrl,
  publishUrl,
  updateUrl
} from "@/lib/googleIndexing";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SubmitSchema = z
  .object({
    type: z.enum(["publish", "update", "delete"]).default("publish"),
    url: z.string().url().optional(),
    urls: z.array(z.string().url()).min(1).max(100).optional()
  })
  .refine((value) => Boolean(value.url || value.urls?.length), {
    message: "url or urls is required."
  });

export async function POST(request: Request) {
  try {
    await protectMutation(request);
    const body = SubmitSchema.parse(await request.json().catch(() => ({})));
    const urls = body.urls?.length ? body.urls : [body.url || ""];
    const jobs =
      body.type === "delete"
        ? urls.length > 1
          ? await batchDelete(urls)
          : [await deleteUrl(urls[0])]
        : body.type === "update"
          ? urls.length > 1
            ? await batchUpdate(urls)
            : [await updateUrl(urls[0])]
          : urls.length > 1
            ? await batchPublish(urls)
            : [await publishUrl(urls[0])];

    return Response.json({
      ok: true,
      queued: jobs.filter((job) => job.status === "pending").length,
      completed: jobs.filter((job) => job.status === "success").length,
      failed: jobs.filter((job) => job.status === "failed").length,
      jobs
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid indexing submission." },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
