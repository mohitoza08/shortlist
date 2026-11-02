import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/primitives";
import { NewRequisitionForm } from "@/components/app/new-requisition-form";

export const metadata = { title: "New requisition" };
export const dynamic = "force-dynamic";

export default async function NewRequisitionPage() {
  const clients = await db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader eyebrow="Requisitions / New" title="New requisition" subtitle="Paste a job description. Review the scorecard before saving." />
      <NewRequisitionForm clients={clients} />
    </>
  );
}
