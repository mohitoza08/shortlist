import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";

/** Submit to client. The viewedAt check is enforced here, not only in the UI. */
export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const app = await db.application.findUnique({ where: { id }, include: { candidate: true } });
  if (!app) throw new ApiError(404, "NOT_FOUND", "Not found.");
  if (!app.viewedAt) throw new ApiError(400, "NOT_VIEWED", "Open this CV before submitting it to the client.");
  if (app.candidate.consentStatus === "WITHDRAWN" || app.candidate.deletedAt) {
    throw new ApiError(400, "CONSENT_WITHDRAWN", "Consent was withdrawn. This candidate cannot be submitted.");
  }
  if (app.parseStatus === "PENDING" || app.parseStatus === "PROCESSING" || app.parseStatus === "QUEUED" || app.parseStatus === "FAILED") {
    throw new ApiError(400, "NOT_READY", "This CV has not finished processing.");
  }
  if (app.submittedAt) return Response.json({ submittedAt: app.submittedAt });
  const updated = await db.application.update({
    where: { id },
    data: { submittedAt: new Date(), stage: "SUBMITTED", stageChangedAt: new Date() },
  });
  await audit(user.id, "SUBMITTED", "Application", id);
  return Response.json({ submittedAt: updated.submittedAt });
});
