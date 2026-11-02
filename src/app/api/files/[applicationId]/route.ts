import { getApplicationFor, handler, requireUser, ApiError } from "@/lib/rbac";
import { getFile } from "@/lib/storage";

/** Private resume stream. Recruiters: any. Clients: only their own submitted candidates. */
export const GET = handler(async (_req: Request, ctx: { params: Promise<{ applicationId: string }> }) => {
  const user = await requireUser();
  const { applicationId } = await ctx.params;
  const app = await getApplicationFor(user, applicationId);
  const buf = await getFile(applicationId);
  if (!buf) throw new ApiError(404, "NOT_FOUND", "This CV is no longer available.");
  const safeName = app.resumeFileName.replace(/[^\w.\- ]/g, "_");
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": app.resumeMime,
      "Content-Disposition": `inline; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
