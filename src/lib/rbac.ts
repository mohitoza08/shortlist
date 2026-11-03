import { auth } from "./auth";
import { ApiError, getApplicationFor, type SessionUser } from "./access";

export { ApiError, getApplicationFor };
export type { SessionUser };

export async function requireUser(): Promise<SessionUser> {
  const s = await auth();
  if (!s?.user?.id) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
  return { id: s.user.id, role: s.user.role, clientId: s.user.clientId, name: s.user.name ?? "" };
}

export async function requireRecruiter() {
  const u = await requireUser();
  if (u.role !== "RECRUITER") throw new ApiError(404, "NOT_FOUND", "Not found.");
  return u;
}

export async function requireClient() {
  const u = await requireUser();
  if (u.role !== "CLIENT" || !u.clientId) throw new ApiError(404, "NOT_FOUND", "Not found.");
  return u as SessionUser & { clientId: string };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) {
    return Response.json({ error: { code: e.code, message: e.message, details: e.details } }, { status: e.status });
  }
  console.error("Unhandled API error", e instanceof Error ? e.name : "unknown");
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong. Try again." } }, { status: 500 });
}

/** Wrap a route handler so ApiError and Zod errors map to the standard shape. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e && typeof e === "object" && "issues" in e) {
        return Response.json(
          { error: { code: "VALIDATION", message: "Check the highlighted fields.", details: (e as { issues: unknown }).issues } },
          { status: 400 },
        );
      }
      return errorResponse(e);
    }
  };
}
