import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/primitives";
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
        eyebrow={`Requisitions / ${req.title}`}
        title="Upload CVs"
        subtitle={`${req.title} · ${req.client.name}`}
      />
      <UploadClient
        requisitionId={id}
        mustHaves={req.criteria.filter((c) => c.type === "SKILL").map((c) => c.label)}
      />
    </>
  );
}
