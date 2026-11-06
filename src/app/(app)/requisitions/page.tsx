import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getMetrics } from "@/lib/metrics";
import { ageLabel } from "@/lib/utils";
import { AvatarInitials, Badge, Button, Card, EmptyState, Input, PageHeader, Progress, Select } from "@/components/ui/primitives";
import { ImpactStrip } from "@/components/app/impact-strip";
import { FairnessPanel } from "@/components/app/fairness-panel";

function TabLinks({ active }: { active: "list" | "fairness" }) {
  const cls = (on: boolean) => `-mb-px border-b-2 pb-2.5 text-sm font-medium ${on ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink"} t-fast`;
  return (
    <nav className="mb-6 flex gap-6 border-b border-line" aria-label="Sections">
      <Link href="/requisitions" className={cls(active === "list")}>Requisitions</Link>
      <Link href="/requisitions?tab=fairness" className={cls(active === "fairness")}>Fairness &amp; audit</Link>
    </nav>
  );
}

export const metadata = { title: "Requisitions" };
export const dynamic = "force-dynamic";

type SP = { q?: string; status?: string; client?: string; sort?: string; tab?: string; action?: string; actor?: string };

export default async function RequisitionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  if (sp.tab === "fairness") {
    return (
      <>
        <PageHeader title="Requisitions" subtitle="Screening workspace for Meridian Talent" />
        <TabLinks active="fairness" />
        <FairnessPanel action={sp.action} actor={sp.actor} />
      </>
    );
  }
  const where: Prisma.RequisitionWhereInput = {
    ...(sp.q ? { title: { contains: sp.q, mode: "insensitive" } } : {}),
    ...(sp.status && ["OPEN", "CLOSED", "DRAFT"].includes(sp.status) ? { status: sp.status as "OPEN" | "CLOSED" | "DRAFT" } : {}),
    ...(sp.client ? { clientId: sp.client } : {}),
  };
  const orderBy: Prisma.RequisitionOrderByWithRelationInput =
    sp.sort === "cvs" ? { applications: { _count: "desc" } } : { createdAt: "desc" };

  const [reqs, clients, metrics] = await Promise.all([
    db.requisition.findMany({
      where,
      orderBy,
      include: {
        client: true,
        createdBy: { select: { name: true } },
        applications: { select: { stage: true, submittedAt: true, parseStatus: true } },
      },
    }),
    db.client.findMany({ orderBy: { name: "asc" } }),
    getMetrics(),
  ]);
  const filtered = !!(sp.q || sp.status || sp.client);

  return (
    <>
      <PageHeader
        title="Requisitions"
        subtitle="Screening workspace for Meridian Talent"
        actions={
          <Link href="/requisitions/new">
            <Button>
              <Plus className="size-4" aria-hidden /> New requisition
            </Button>
          </Link>
        }
      />
      <ImpactStrip m={metrics} />
      <TabLinks active="list" />

      <form className="mb-5 flex flex-wrap items-center gap-2.5" role="search">
        <Input name="q" defaultValue={sp.q} placeholder="Search roles" aria-label="Search roles" className="h-10 min-w-[220px] flex-1 sm:max-w-sm" />
        <Select name="status" defaultValue={sp.status ?? ""} aria-label="Status" className="w-[140px]">
          <option value="">All statuses</option>
          <option value="OPEN">Open</option>
          <option value="CLOSED">Closed</option>
          <option value="DRAFT">Draft</option>
        </Select>
        <Select name="client" defaultValue={sp.client ?? ""} aria-label="Client" className="w-[170px]">
          <option value="">All clients</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={sp.sort ?? ""} aria-label="Sort" className="w-[140px]">
          <option value="">Newest</option>
          <option value="cvs">Most CVs</option>
        </Select>
        <Button type="submit" variant="secondary">
          Apply
        </Button>
        {filtered && (
          <Link href="/requisitions" className="text-sm text-muted underline-offset-2 hover:text-ink hover:underline">
            Clear
          </Link>
        )}
      </form>

      {reqs.length === 0 ? (
        filtered ? (
          <EmptyState title="No requisitions match these filters" action={<Link href="/requisitions"><Button variant="secondary">Clear filters</Button></Link>} />
        ) : (
          <EmptyState
            title="No requisitions yet."
            body="Paste a job description to build the first scorecard."
            action={<Link href="/requisitions/new"><Button>Create your first requisition</Button></Link>}
          />
        )
      ) : (
        <>
          {/* Desktop table */}
          <Card className="hidden overflow-hidden md:block">
            <table className="w-full text-left">
              <thead className="border-b border-line bg-surface-2/60">
                <tr className="label">
                  {["Role", "Progress", "CVs", "Submitted", "Age", ""].map((h) => (
                    <th key={h} className="px-5 py-3 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {reqs.map((r) => {
                  const submitted = r.applications.filter((a) => a.submittedAt).length;
                  const processed = r.applications.filter((a) => a.parseStatus === "PARSED" || a.parseStatus === "NEEDS_REVIEW").length;
                  const total = r.applications.length;
                  return (
                    <tr key={r.id} className="group relative border-b border-line last:border-0 t-fast hover:bg-surface-2/60">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <AvatarInitials name={r.client.name} size={38} />
                          <div className="min-w-0">
                            <Link href={`/requisitions/${r.id}`} className="font-medium tracking-[-0.01em] after:absolute after:inset-0 group-hover:text-accent">
                              {r.title}
                            </Link>
                            <p className="mt-0.5 text-[13px] text-muted">
                              {r.client.name} · {r.location || "Location open"} · {r.minExpYears}–{r.maxExpYears} yrs
                            </p>
                          </div>
                          {r.status !== "OPEN" && <Badge className="ml-1">{r.status.toLowerCase()}</Badge>}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <Progress value={processed} max={total} label={`${processed} of ${total} CVs scored`} className="w-32" />
                        <p className="mono mt-1.5 text-[11.5px] text-muted">{processed}/{total} scored</p>
                      </td>
                      <td className="mono px-5 py-4 text-[14px]">{total}</td>
                      <td className="mono px-5 py-4 text-[14px]">{submitted}</td>
                      <td className="px-5 py-4 text-[13px] text-muted">{ageLabel(r.createdAt)}</td>
                      <td className="px-5 py-4 text-right">
                        <ChevronRight className="inline size-4 text-muted t-fast group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* Mobile cards */}
          <ul className="space-y-3 md:hidden">
            {reqs.map((r) => (
              <li key={r.id}>
                <Link href={`/requisitions/${r.id}`}>
                  <Card className="p-4 t-fast hover:shadow-[var(--shadow-hover)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <AvatarInitials name={r.client.name} size={36} />
                        <div>
                          <p className="font-medium tracking-[-0.01em]">{r.title}</p>
                          <p className="text-xs text-muted">{r.client.name}</p>
                        </div>
                      </div>
                      <Badge tone={r.status === "OPEN" ? "accent" : "neutral"}>{r.status.toLowerCase()}</Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted">
                      {r.applications.length} CVs · {r.applications.filter((a) => a.submittedAt).length} submitted · {ageLabel(r.createdAt)}
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
