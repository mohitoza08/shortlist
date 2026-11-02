import type { AuditAction, Prisma } from "@prisma/client";
import { db } from "./db";

/** Never put resume text or contact details in `meta`. */
export async function audit(
  actorId: string | null,
  action: AuditAction,
  entityType: string,
  entityId: string,
  meta?: Prisma.InputJsonValue,
) {
  await db.auditLog.create({ data: { actorId, action, entityType, entityId, meta } });
}
