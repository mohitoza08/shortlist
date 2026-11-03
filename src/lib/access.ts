import { db } from "./db";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export type SessionUser = { id: string; role: "RECRUITER" | "CLIENT"; clientId: string | null; name: string };

/** Recruiter: any application. Client: only own client's submitted applications. 404 otherwise. */
export async function getApplicationFor(user: SessionUser, id: string) {
  const app = await db.application.findUnique({
    where: { id },
    include: { requisition: true, candidate: true },
  });
  if (!app) throw new ApiError(404, "NOT_FOUND", "Not found.");
  if (user.role === "CLIENT") {
    if (app.requisition.clientId !== user.clientId || !app.submittedAt || app.candidate.deletedAt) {
      throw new ApiError(404, "NOT_FOUND", "Not found.");
    }
  }
  return app;
}

