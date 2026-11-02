import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { rescoreApplication } from "@/lib/rescore";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";
import { profilePatch } from "@/lib/validation";

export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const patch = profilePatch.parse(await req.json());
  const app = await db.application.findUnique({ where: { id } });
  if (!app) throw new ApiError(404, "NOT_FOUND", "Not found.");
  const profile = { ...((app.parsedProfile as object | null) ?? {}), ...patch, edited: true };
  await db.application.update({ where: { id }, data: { parsedProfile: profile } });
  if (patch.location) await db.candidate.update({ where: { id: app.candidateId }, data: { location: patch.location } });
  await audit(user.id, "PROFILE_EDITED", "Application", id, { fields: Object.keys(patch) });
  const score = await rescoreApplication(id);
  await audit(user.id, "SCORE_RERUN", "Application", id, { overall: score, source: "recruiter-edit" });
  return Response.json({ overallScore: score });
});
