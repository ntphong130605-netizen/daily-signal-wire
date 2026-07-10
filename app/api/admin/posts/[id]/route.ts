import { z } from "zod";
import { apiError, protectMutation } from "@/lib/apiSecurity";
import { prisma } from "@/lib/prisma";

const DraftSchema = z.object({
  title: z.string().min(10).max(160),
  excerpt: z.string().min(20).max(500),
  content: z.string().min(100),
  seoTitle: z.string().min(10).max(100),
  seoDescription: z.string().min(20).max(300),
  facebookCaption: z.string().min(10).max(1000),
  imagePrompt: z.string().max(4000).nullable().optional(),
  imageAlt: z.string().max(300).nullable().optional(),
  imageCaption: z.string().max(500).nullable().optional(),
  imageDisclosure: z.string().max(300).nullable().optional(),
  factCheckNotes: z.array(z.string().min(1)).max(50),
  sourceUrls: z.array(z.string().url()).max(20)
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const data = DraftSchema.parse(await request.json());
    const { id } = await params;
    await prisma.post.update({
      where: { id },
      data: {
        ...data,
        factCheckNotes: JSON.stringify(data.factCheckNotes),
        sourceUrls: JSON.stringify(data.sourceUrls)
      }
    });
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: error.issues[0]?.message || "Invalid draft" },
        { status: 400 }
      );
    }
    return apiError(error);
  }
}
