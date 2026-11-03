import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { getApplicationFor, handler, requireClient } from "@/lib/rbac";
import { REJECT_REASONS } from "@/lib/stages";

const slot = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  tz: z.string().max(40).default("IST"),
});

const body = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("SHORTLIST") }),
  z.object({ decision: z.literal("REJECT"), reason: z.enum(REJECT_REASONS), note: z.string().max(500).optional() }),
  z.object({ decision: z.literal("PROPOSE_SLOT"), slots: z.array(slot).min(1).max(2), note: z.string().max(500).optional() }),
]);

/** Client decision on a submitted candidate. getApplicationFor returns 404 for anything not theirs. */
export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireClient();
  const { id } = await ctx.params;
  const b = body.parse(await req.json());
  const app = await getApplicationFor(user, id);
  const now = new Date();

  if (b.decision === "SHORTLIST") {
    await db.application.update({ where: { id }, data: { clientDecision: "SHORTLISTED", clientReason: null, stage: "CLIENT_REVIEW", stageChangedAt: now } });
    await audit(user.id, "CLIENT_SHORTLISTED", "Application", id);
  } else if (b.decision === "REJECT") {
    await db.application.update({
      where: { id },
      data: { clientDecision: "REJECTED", clientReason: b.reason, clientNote: b.note ?? null, stage: "REJECTED", stageChangedAt: now },
    });
    await audit(user.id, "CLIENT_REJECTED", "Application", id, { reason: b.reason });
  } else {
    await db.application.update({
      where: { id },
      data: { clientDecision: "INTERVIEW_PROPOSED", proposedSlots: b.slots, clientNote: b.note ?? null, stage: "INTERVIEW", stageChangedAt: now },
    });
    await audit(user.id, "SLOT_PROPOSED", "Application", id, { slots: b.slots.length });
  }
  return Response.json({ ok: true, requisitionId: app.requisitionId });
});
