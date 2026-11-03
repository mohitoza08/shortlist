import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Button, PageHeader } from "@/components/ui/primitives";
import { PipelineClient, type PipelineCard } from "@/components/app/pipeline-client";

export const metadata = { title: "Pipeline" };
export const dynamic = "force-dynamic";

export default async function PipelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const req = await db.requisition.findUnique({
    where: { id },
    include: { client: true, applications: { where: { candidate: { deletedAt: null }, duplicateStatus: { not: "CONFIRMED" } }, include: { candidate: true }, orderBy: { overallScore: { sort: "desc", nulls: "last" } } } },
  });
  if (!req) notFound();
  const cards: PipelineCard[] = req.applications.map((a) => {
    const p = (a.parsedProfile as Record<string, unknown> | null) ?? {};
    return {
      id: a.id, name: a.candidate.fullName, role: (p.currentRole as string) ?? null, score: a.overallScore, stage: a.stage,
      stageChangedAt: a.stageChangedAt.toISOString(), decision: a.clientDecision, reason: a.clientReason, viewed: !!a.viewedAt,
      slots: (a.proposedSlots as { date: string; time: string; tz: string }[] | null) ?? null,
    };
  });
  return (
    <>
      <PageHeader
        eyebrow={<Link href="/requisitions" className="hover:text-ink">Requisitions</Link>}
        title={`${req.title} · Pipeline`}
        subtitle={req.client.name}
        actions={
          <>
            <Link href={`/requisitions/${id}`}><Button variant="secondary">Ranked list</Button></Link>
            <Link href={`/requisitions/${id}/upload`}><Button variant="secondary">Upload CVs</Button></Link>
          </>
        }
      />
      <PipelineClient requisitionId={id} initial={cards} />
    </>
  );
}
