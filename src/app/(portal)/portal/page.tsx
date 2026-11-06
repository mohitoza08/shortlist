import Link from "next/link";
import { db } from "@/lib/db";
import { requireClient } from "@/lib/rbac";
import { ageLabel } from "@/lib/utils";
import { Badge, Button, Card, EmptyState } from "@/components/ui/primitives";

export const metadata = { title: "Your shortlists" };
export const dynamic = "force-dynamic";

export default async function PortalHome() {
  const user = await requireClient();
  const reqs = await db.requisition.findMany({
    where: { clientId: user.clientId, applications: { some: { submittedAt: { not: null }, candidate: { deletedAt: null } } } },
    orderBy: { updatedAt: "desc" },
    include: { applications: { where: { submittedAt: { not: null }, candidate: { deletedAt: null } }, select: { clientDecision: true, submittedAt: true, clientViewedAt: true } } },
  });
  return (
    <>
      <h1 className="display rise mb-2 text-[34px] sm:text-[44px]">Your shortlists</h1>
      <p className="mb-8 max-w-lg text-[15px] leading-6 text-muted">Candidates shared with you by Meridian Talent. Every score links back to a line in the CV.</p>
      {reqs.length === 0 ? (
        <EmptyState title="No shortlists yet." body="Your recruiter will share candidates here." />
      ) : (
        <ul className="space-y-4">
          {reqs.map((r) => {
            const pending = r.applications.filter((a) => a.clientDecision === "PENDING").length;
            const last = r.applications.reduce((m, a) => (a.submittedAt && a.submittedAt > m ? a.submittedAt : m), r.createdAt);
            return (
              <li key={r.id}>
                <Card className="p-6 t-fast hover:shadow-[var(--shadow-hover)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="display text-[24px] leading-8">{r.title}</h2>
                      <p className="text-sm text-muted">{r.location || "Location open"} · {r.minExpYears}–{r.maxExpYears} years</p>
                    </div>
                    {pending > 0 && <Badge tone="accent">{pending} new</Badge>}
                  </div>
                  <p className="mt-3 text-sm text-muted">{r.applications.length} candidate{r.applications.length === 1 ? "" : "s"} submitted · updated {ageLabel(last)} ago</p>
                  <Link href={`/portal/${r.id}`} className="mt-4 block"><Button size="lg" className="w-full sm:w-auto">Review shortlist</Button></Link>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
