import { db } from "@/lib/db";
import { PageHeader, Steps } from "@/components/ui/primitives";
import { NewRequisitionForm } from "@/components/app/new-requisition-form";

export const metadata = { title: "New requisition" };
export const dynamic = "force-dynamic";

export default async function NewRequisitionPage() {
  const clients = await db.client.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <>
      <PageHeader eyebrow="Requisitions / New" title="Paste the JD." subtitle="We turn it into a scorecard you can check and tweak before a single CV is scored." />
      <Steps steps={["Scorecard", "Upload CVs", "Ranked list"]} current={0} />
      <NewRequisitionForm clients={clients} />
    </>
  );
}
