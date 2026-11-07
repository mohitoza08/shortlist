import Link from "next/link";
import { db } from "@/lib/db";
import { AvatarInitials, Badge, Card, EmptyState, PageHeader, ScoreRing } from "@/components/ui/primitives";

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
      <PageHeader
        title="Your queue."
        subtitle="CVs that need a recruiter’s eyes before they can go to a client. Highest scores first, so the best candidates are never waiting."
        actions={items.length > 0 ? <Badge tone="accent">{items.length} waiting</Badge> : undefined}
      />
      {items.length === 0 ? (
        <EmptyState title="All clear." body="Scored CVs appear here until you open them." />
      ) : (
        <Card className="overflow-hidden">
          <ul>
            {items.map((a) => (
              <li key={a.id} className="border-b border-line last:border-0">
                <Link href={`/requisitions/${a.requisition.id}?candidate=${a.id}`} className="group flex items-center gap-4 px-5 py-4 t-fast hover:bg-surface-2/60">
                  <AvatarInitials name={a.candidate.fullName} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tracking-[-0.01em] group-hover:text-accent">{a.candidate.fullName}</p>
                    <p className="truncate text-[13px] text-muted">
                      {a.requisition.title}
                      {a.parseStatus === "NEEDS_REVIEW" && Array.isArray(a.parseReasons) && a.parseReasons[0] ? ` · ${String(a.parseReasons[0])}` : ""}
                    </p>
                  </div>
                  {a.parseStatus === "NEEDS_REVIEW" ? <Badge tone="warn">Needs review</Badge> : <Badge>Not opened</Badge>}
                  <ScoreRing score={a.overallScore} size={44} />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
