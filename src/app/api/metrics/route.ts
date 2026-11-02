import { getMetrics } from "@/lib/metrics";
import { handler, requireRecruiter } from "@/lib/rbac";

export const GET = handler(async () => {
  await requireRecruiter();
  return Response.json(await getMetrics());
});
