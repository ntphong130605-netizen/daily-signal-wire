import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { protectMutation, apiError } from "@/lib/apiSecurity";

const ReadSchema = z.object({
  isRead: z.boolean().optional()
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const body = ReadSchema.parse(await request.json().catch(() => ({})));
    const current = await prisma.feedStory.findUniqueOrThrow({
      where: { id },
      select: { isRead: true }
    });
    const story = await prisma.feedStory.update({
      where: { id },
      data: { isRead: body.isRead ?? !current.isRead }
    });
    return Response.json({ id: story.id, isRead: story.isRead });
  } catch (error) {
    return apiError(error);
  }
}
