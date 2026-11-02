import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";

/** Opening the CV sets viewedAt. This is what the submit gate checks, server-side. */
export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const app = await db.application.findUnique({ where: { id }, select: { id: true, viewedAt: true } });
  if (!app) throw new ApiError(404, "NOT_FOUND", "Not found.");
  const viewedAt = app.viewedAt ?? new Date();
  if (!app.viewedAt) await db.application.update({ where: { id }, data: { viewedAt } });
  await audit(user.id, "CV_VIEWED", "Application", id);
  return Response.json({ viewedAt });
});
