import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { maskEmail, maskPhone } from "@/lib/mask";
import { requireClient } from "@/lib/rbac";
import { PortalReview, type PortalCandidate } from "@/components/portal/portal-review";

function uniqueByQuote<T extends { quote: string }>(xs: T[]) {
  const seen = new Set<string>();
  return xs.filter((x) => (seen.has(x.quote) ? false : (seen.add(x.quote), true)));
}

export const dynamic = "force-dynamic";

export default async function PortalReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClient();
  const { id } = await params;
  const req = await db.requisition.findFirst({
    where: { id, clientId: user.clientId },
    include: {
      applications: {
        where: { submittedAt: { not: null }, candidate: { deletedAt: null } },
        orderBy: { overallScore: { sort: "desc", nulls: "last" } },
        include: { candidate: true, criterionScores: { include: { criterion: true } } },
      },
    },
  });
  // Not this client's requisition, or nothing submitted: 404, never 403.
  if (!req || req.applications.length === 0) notFound();

  const candidates: PortalCandidate[] = req.applications.map((a) => {
    const p = (a.parsedProfile as Record<string, unknown> | null) ?? {};
    return {
      id: a.id,
      name: a.candidate.fullName,
      role: (p.currentRole as string) ?? null,
      years: (p.yearsExperience as number) ?? null,
      location: a.candidate.location || null,
      maskedEmail: maskEmail(a.candidate.email),
      maskedPhone: maskPhone(a.candidate.phone),
      score: a.overallScore,
      confidence: a.parseConfidence,
      highlights: uniqueByQuote(a.criterionScores.filter((s) => s.grounded && s.evidenceQuote).sort((x, y) => y.score - x.score).map((s) => ({ label: s.criterion.label, quote: s.evidenceQuote! }))).slice(0, 3),
      decision: a.clientDecision,
      reason: a.clientReason,
      slots: (a.proposedSlots as { date: string; time: string; tz: string }[] | null) ?? null,
      hasCv: a.parseStatus !== "FAILED" && a.resumeFileName !== "deleted",
    };
  });
  return (
    <>
      <Link href="/portal" className="text-sm text-muted hover:text-ink">← All shortlists</Link>
      <h1 className="display mt-2 text-[32px] leading-10">{req.title}</h1>
      <p className="mt-1 text-muted">
        {req.location || "Location open"} · {req.minExpYears}–{req.maxExpYears} years · notice up to {req.noticeMaxDays} days
      </p>
      <p className="mb-6 mt-3 text-sm">
        {candidates.length} candidate{candidates.length === 1 ? "" : "s"} shortlisted for your review. Each score shows the line from the CV that earned it.
      </p>
      <PortalReview candidates={candidates} />
    </>
  );
}
