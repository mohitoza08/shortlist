import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader, Steps } from "@/components/ui/primitives";
import { UploadClient } from "@/components/app/upload-client";

export const metadata = { title: "Upload CVs" };
export const dynamic = "force-dynamic";

export default async function UploadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const req = await db.requisition.findUnique({
    where: { id },
    include: { client: true, criteria: { where: { mustHave: true }, orderBy: { order: "asc" } } },
  });
  if (!req) notFound();
  return (
    <>
      <PageHeader
        eyebrow={<span>Requisitions / {req.title}</span>}
        title="Drop the CVs."
        subtitle={`${req.title} · ${req.client.name}. Each CV is read, scored and ranked as it lands.`}
      />
      <Steps steps={["Scorecard", "Upload CVs", "Ranked list"]} current={1} />
      <UploadClient
        requisitionId={id}
        mustHaves={req.criteria.filter((c) => c.type === "SKILL").map((c) => c.label)}
      />
    </>
  );
}
