import type { AuditAction, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { handler, requireRecruiter } from "@/lib/rbac";

export const GET = handler(async (req: Request) => {
  await requireRecruiter();
  const u = new URL(req.url);
  const where: Prisma.AuditLogWhereInput = {
    ...(u.searchParams.get("actor") ? { actorId: u.searchParams.get("actor")! } : {}),
    ...(u.searchParams.get("action") ? { action: u.searchParams.get("action") as AuditAction } : {}),
    ...(u.searchParams.get("entity") ? { entityId: u.searchParams.get("entity")! } : {}),
  };
  const items = await db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { actor: { select: { name: true } } } });
  return Response.json({ items: items.map((a) => ({ id: a.id, action: a.action, entityType: a.entityType, entityId: a.entityId, actor: a.actor?.name ?? "System", at: a.createdAt })) });
});
