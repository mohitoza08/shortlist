import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { handler, requireRecruiter, ApiError } from "@/lib/rbac";
import { requisitionBody } from "@/lib/validation";

export const POST = handler(async (req: Request) => {
  const user = await requireRecruiter();
  const body = requisitionBody.parse(await req.json());
  if (body.maxExpYears < body.minExpYears) {
    throw new ApiError(400, "VALIDATION", "Max experience must be at least the minimum.");
  }
  const client = await db.client.findUnique({ where: { id: body.clientId } });
  if (!client) throw new ApiError(400, "VALIDATION", "Choose a client.");
  const created = await db.requisition.create({
    data: {
      clientId: body.clientId,
      createdById: user.id,
      title: body.title,
      jdText: body.jdText,
      location: body.location,
      minExpYears: body.minExpYears,
      maxExpYears: body.maxExpYears,
      noticeMaxDays: body.noticeMaxDays,
      ctcMaxLpa: body.ctcMaxLpa,
      criteria: {
        create: body.criteria.map((c, i) => ({
          label: c.label,
          type: c.type,
          weight: c.weight,
          mustHave: c.mustHave,
          expectedValue: c.expectedValue ?? null,
          order: i,
        })),
      },
    },
  });
  await audit(user.id, "REQUISITION_CREATED", "Requisition", created.id, { title: created.title });
  return Response.json({ id: created.id }, { status: 201 });
});
