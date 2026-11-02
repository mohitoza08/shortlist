import Link from "next/link";
import { notFound } from "next/navigation";
import { Upload } from "lucide-react";
import { db } from "@/lib/db";
import { Badge, Button, PageHeader } from "@/components/ui/primitives";
import { RankedClient, type RankedRow } from "@/components/app/ranked-client";

export const dynamic = "force-dynamic";

export default async function RankedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const req = await db.requisition.findUnique({
    where: { id },
    include: {
      client: true,
      criteria: { orderBy: { order: "asc" } },
      applications: {
        orderBy: [{ overallScore: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        include: { candidate: true, criterionScores: true },
      },
    },
  });
  if (!req) notFound();
  const must = req.criteria.filter((c) => c.mustHave && c.type === "SKILL");

  const rows: RankedRow[] = req.applications.map((a) => {
    const p = (a.parsedProfile as Record<string, unknown> | null) ?? {};
    const byCrit = new Map(a.criterionScores.map((s) => [s.criterionId, s]));
    const met = must.filter((m) => (byCrit.get(m.id)?.score ?? 0) >= 50).length;
    const quote = a.criterionScores
      .filter((s) => s.grounded && s.evidenceQuote)
      .sort((x, y) => y.score - x.score)[0]?.evidenceQuote ?? null;
    return {
      id: a.id,
      name: a.candidate.fullName,
      fileName: a.resumeFileName,
      role: (p.currentRole as string) ?? null,
      years: (p.yearsExperience as number) ?? null,
      notice: (p.noticeDays as number) ?? null,
      location: a.candidate.location || ((p.location as string) ?? ""),
      score: a.overallScore,
      confidence: a.parseConfidence,
      status: a.parseStatus,
      reasons: (a.parseReasons as string[] | null) ?? [],
      stage: a.stage,
      duplicate: a.duplicateStatus,
      viewed: !!a.viewedAt,
      submitted: !!a.submittedAt,
      consent: a.candidate.consentStatus,
      mustMet: met,
      mustTotal: must.length,
      topQuote: quote,
      createdAt: a.createdAt.toISOString(),
      skills: ((p.skills as string[]) ?? []).map((s) => s.toLowerCase()),
    };
  });

  return (
    <>
      <PageHeader
        eyebrow={<Link href="/requisitions" className="hover:text-ink">Requisitions</Link>}
        title={req.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span>{req.client.name}</span>
            <Badge tone={req.status === "OPEN" ? "accent" : "neutral"}>{req.status.toLowerCase()}</Badge>
            {must.map((m) => <Badge key={m.id}>{m.label}</Badge>)}
          </span>
        }
        actions={
          <Link href={`/requisitions/${id}/upload`}>
            <Button variant="secondary"><Upload className="size-4" aria-hidden /> Upload CVs</Button>
          </Link>
        }
      />
      <RankedClient requisitionId={id} rows={rows} noticeMax={req.noticeMaxDays} />
    </>
  );
}
