import { processApplication } from "@/lib/ai/pipeline";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";
import { db } from "@/lib/db";

export const maxDuration = 60;

export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const app = await db.application.findUnique({ where: { id }, select: { id: true } });
  if (!app) throw new ApiError(404, "NOT_FOUND", "Not found.");
  await db.application.update({
    where: { id },
    data: { parseStatus: "PENDING", overallScore: null, resumeText: null, parseReasons: [] },
  });
  return Response.json(await processApplication(id, user.id));
});
