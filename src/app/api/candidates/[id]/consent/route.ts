import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";

const body = z.object({ status: z.enum(["GIVEN", "PENDING", "WITHDRAWN"]), note: z.string().max(300).optional() });

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const b = body.parse(await req.json());
  const c = await db.candidate.findUnique({ where: { id } });
  if (!c || c.deletedAt) throw new ApiError(404, "NOT_FOUND", "Not found.");
  if (b.status === "WITHDRAWN" && !b.note?.trim()) throw new ApiError(400, "VALIDATION", "Add a note about how consent was withdrawn.");
  await db.candidate.update({ where: { id }, data: { consentStatus: b.status, consentNote: b.note ?? null, consentAt: new Date() } });
  await audit(user.id, "CONSENT_UPDATED", "Candidate", id, { status: b.status });
  return Response.json({ status: b.status });
});
