import Link from "next/link";
import { db } from "@/lib/db";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/primitives";

export const metadata = { title: "Review" };
export const dynamic = "force-dynamic";

/** Everything waiting on a human: CVs flagged for review, and scored CVs not yet opened. */
export default async function ReviewPage() {
  const items = await db.application.findMany({
    where: {
      submittedAt: null,
      candidate: { deletedAt: null, consentStatus: { not: "WITHDRAWN" } },
      OR: [{ parseStatus: "NEEDS_REVIEW" }, { parseStatus: "PARSED", viewedAt: null }],
    },
    orderBy: [{ overallScore: { sort: "desc", nulls: "last" } }],
    take: 100,
    include: { candidate: true, requisition: { select: { id: true, title: true } } },
  });
  return (
    <>
      <PageHeader title="Review" subtitle="CVs that need a recruiter’s eyes before they can go to a client." />
      {items.length === 0 ? (
        <EmptyState title="Nothing waiting for review." body="Scored CVs appear here until you open them." />
      ) : (
        <Card>
          <ul>
            {items.map((a) => (
              <li key={a.id} className="border-b border-line last:border-0">
                <Link href={`/requisitions/${a.requisition.id}?candidate=${a.id}`} className="flex items-center justify-between gap-4 px-4 py-3.5 t-fast hover:bg-surface-2/50">
                  <div className="min-w-0">
                    <p className="font-medium">{a.candidate.fullName}</p>
                    <p className="truncate text-xs text-muted">{a.requisition.title}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.parseStatus === "NEEDS_REVIEW" ? <Badge tone="warn">Needs review</Badge> : <Badge>Not opened</Badge>}
                    <span className="w-8 text-right font-semibold tabular-nums">{a.overallScore != null ? Math.round(a.overallScore) : "—"}</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
