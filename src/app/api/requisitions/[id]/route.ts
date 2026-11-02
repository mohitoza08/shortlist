import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { handler, requireRecruiter, ApiError } from "@/lib/rbac";
import { requisitionPatch } from "@/lib/validation";

export const PATCH = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRecruiter();
  const { id } = await ctx.params;
  const body = requisitionPatch.parse(await req.json());
  const existing = await db.requisition.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "NOT_FOUND", "Not found.");
  const { criteria, ...fields } = body;
  await db.$transaction(async (tx) => {
    await tx.requisition.update({ where: { id }, data: fields });
    if (criteria) {
      await tx.scorecardCriterion.deleteMany({ where: { requisitionId: id } });
      await tx.scorecardCriterion.createMany({
        data: criteria.map((c, i) => ({
          requisitionId: id,
          label: c.label,
          type: c.type,
          weight: c.weight,
          mustHave: c.mustHave,
          expectedValue: c.expectedValue ?? null,
          order: i,
        })),
      });
      // Scores refer to old criteria; mark applications for re-scoring.
      await tx.application.updateMany({
        where: { requisitionId: id, parseStatus: { in: ["PARSED", "NEEDS_REVIEW"] } },
        data: { parseStatus: "PENDING", overallScore: null },
      });
    }
  });
  await audit(user.id, "SCORECARD_UPDATED", "Requisition", id, { criteriaChanged: !!criteria });
  return Response.json({ id });
});
