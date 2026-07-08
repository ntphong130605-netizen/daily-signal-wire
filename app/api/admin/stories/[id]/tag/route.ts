import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { protectMutation, apiError } from "@/lib/apiSecurity";
import { slugify } from "@/lib/slug";

const TagSchema = z.object({
  tag: z.string().min(2).max(40)
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const { tag } = TagSchema.parse(await request.json());
    const clean = tag.trim();
    const slug = slugify(clean);
    const storyTag = await prisma.storyTag.upsert({
      where: { slug },
      update: { name: clean },
      create: { name: clean, slug }
    });
    await prisma.feedStory.update({
      where: { id },
      data: { tags: { connect: { id: storyTag.id } } }
    });
    return Response.json({ tag: storyTag });
  } catch (error) {
    return apiError(error);
  }
}
