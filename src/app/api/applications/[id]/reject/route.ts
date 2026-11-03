import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";
import { REJECT_REASONS } from "@/lib/stages";

const body = z.object({ reason: z.enum(REJECT_REASONS), note: z.string().max(500).optional() });

/** Recruiter rejection. Humans decide; the rejected candidate stays searchable. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const b = body.parse(await req.json());
  const app = await db.application.findUnique({ where: { id } });
  if (!app) throw new ApiError(404, "NOT_FOUND", "Not found.");
  await db.application.update({
    where: { id },
    data: { stage: "REJECTED", stageChangedAt: new Date(), recruiterNotes: b.note ? `${b.reason}: ${b.note}` : b.reason },
  });
  await audit(user.id, "STAGE_CHANGED", "Application", id, { from: app.stage, to: "REJECTED", reason: b.reason });
  return Response.json({ stage: "REJECTED" });
});
