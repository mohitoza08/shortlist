import { db } from "@/lib/db";
import { deleteCandidate } from "@/lib/deletion";
import { ApiError, handler, requireRecruiter } from "@/lib/rbac";

/** Processes a deletion. Requires an open deletion request so it cannot happen by accident. */
export const POST = handler(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const c = await db.candidate.findUnique({ where: { id } });
  if (!c) throw new ApiError(404, "NOT_FOUND", "Not found.");
  if (c.deletedAt) return Response.json({ ok: true });
  const open = await db.deletionRequest.findFirst({ where: { candidateId: id, processedAt: null } });
  if (!open) throw new ApiError(400, "NO_REQUEST", "Record a deletion request first.");
  await deleteCandidate(id, user.id);
  return Response.json({ ok: true });
});
