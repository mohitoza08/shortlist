import { db } from "@/lib/db";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";
import { duplicateBody } from "@/lib/validation";

/** Recruiter decision on a flagged duplicate. Nothing is merged or deleted automatically. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireRecruiter();
  const { id } = await ctx.params;
  const { action } = duplicateBody.parse(await req.json());
  const app = await db.application.findUnique({ where: { id } });
  if (!app) throw new ApiError(404, "NOT_FOUND", "Not found.");
  if (action === "keep") {
    await db.application.update({ where: { id }, data: { duplicateStatus: "IGNORED" } });
    return Response.json({ ok: true });
  }
  // Skip: the recruiter chose to drop this upload. Remove only this application and its candidate shell.
  const others = await db.application.count({ where: { candidateId: app.candidateId, id: { not: id } } });
  await db.application.delete({ where: { id } });
  if (others === 0) await db.candidate.delete({ where: { id: app.candidateId } });
  return Response.json({ ok: true, removed: true });
});
