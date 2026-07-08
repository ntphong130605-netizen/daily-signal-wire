import { prisma } from "@/lib/prisma";
import { protectMutation, apiError } from "@/lib/apiSecurity";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await protectMutation(request);
    const { id } = await params;
    const existing = await prisma.savedStory.findFirst({
      where: { storyId: id, userId: null }
    });
    if (existing) {
      await prisma.savedStory.delete({ where: { id: existing.id } });
      return Response.json({ saved: false });
    }
    await prisma.savedStory.create({ data: { storyId: id } });
    return Response.json({ saved: true });
  } catch (error) {
    return apiError(error);
  }
}
