import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";

const body = z.object({ note: z.string().max(300).optional() });

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const b = body.parse(await req.json().catch(() => ({})));
  const c = await db.candidate.findUnique({ where: { id } });
  if (!c || c.deletedAt) throw new ApiError(404, "NOT_FOUND", "Not found.");
  const open = await db.deletionRequest.findFirst({ where: { candidateId: id, processedAt: null } });
  if (open) return Response.json({ id: open.id, status: open.status });
  const r = await db.deletionRequest.create({ data: { candidateId: id, requestedById: user.id, note: b.note } });
  await audit(user.id, "DELETION_REQUESTED", "Candidate", id);
  return Response.json({ id: r.id, status: r.status }, { status: 201 });
});
