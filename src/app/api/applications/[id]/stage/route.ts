import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";
import { STAGES } from "@/lib/stages";

const body = z.object({ stage: z.enum([...STAGES, "REJECTED"]) });

/** Move a candidate between pipeline stages. Audited. Submission needs viewedAt. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const { stage } = body.parse(await req.json());
  const app = await db.application.findUnique({ where: { id }, include: { candidate: true } });
  if (!app) throw new ApiError(404, "NOT_FOUND", "Not found.");
  if (app.candidate.consentStatus === "WITHDRAWN" || app.candidate.deletedAt) {
    throw new ApiError(400, "CONSENT_WITHDRAWN", "Consent was withdrawn. This candidate cannot be moved.");
  }
  if (stage === "REJECTED") throw new ApiError(400, "USE_REJECT", "Use Reject so a reason is recorded.");
  if (stage === "SUBMITTED") {
    if (!app.viewedAt) throw new ApiError(400, "NOT_VIEWED", "Open this CV before submitting it to the client.");
  }
  if (["SUBMITTED", "CLIENT_REVIEW", "INTERVIEW", "OFFERED", "JOINED"].includes(stage) && !app.viewedAt) {
    throw new ApiError(400, "NOT_VIEWED", "Open this CV before moving it past shortlisting.");
  }
  if (app.stage === stage) return Response.json({ stage });
  const submittedAt = stage === "SUBMITTED" || (app.submittedAt ?? null) ? (app.submittedAt ?? new Date()) : null;
  await db.application.update({ where: { id }, data: { stage, stageChangedAt: new Date(), submittedAt } });
  await audit(user.id, "STAGE_CHANGED", "Application", id, { from: app.stage, to: stage });
  return Response.json({ stage });
});
