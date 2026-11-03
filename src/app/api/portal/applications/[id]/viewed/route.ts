import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getApplicationFor, handler, requireClient } from "@/lib/rbac";

/** Records that the client opened the candidate (access log + moves Submitted to Client review). */
export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireClient();
  const { id } = await ctx.params;
  const app = await getApplicationFor(user, id);
  if (!app.clientViewedAt) {
    await db.application.update({
      where: { id },
      data: { clientViewedAt: new Date(), ...(app.stage === "SUBMITTED" ? { stage: "CLIENT_REVIEW", stageChangedAt: new Date() } : {}) },
    });
  }
  await audit(user.id, "CLIENT_VIEWED", "Application", id);
  return Response.json({ ok: true });
});
