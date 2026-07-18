import { absoluteUrl } from "@/lib/site";
import { prisma, safeDbQuery } from "@/lib/prisma";
import { recordSocialClick } from "@/lib/socialDistribution";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const variantKey = new URL(request.url).searchParams.get("variant");
  const job = await safeDbQuery("social_click_lookup_failed", null, () =>
    recordSocialClick(id, variantKey)
  );
  if (!job) return Response.redirect(absoluteUrl("/"), 302);
  const destination =
    job.utmUrl ||
    (await prisma.post
      .findUnique({ where: { id: job.articleId }, select: { slug: true } })
      .then((post) => (post ? absoluteUrl(`/news/${post.slug}`) : absoluteUrl("/")))
      .catch(() => absoluteUrl("/")));
  return Response.redirect(destination, 302);
}
